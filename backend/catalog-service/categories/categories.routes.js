const router = require('express').Router();
const pool = require('../db/pool');
const requireRoles = require('../middlewares/requireRoles');
const { requireFields } = require('../middlewares/validate');

const canWriteCatalog = requireRoles(['admin', 'manager']);

function toSlug(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// GET /categories — Cây danh mục (public)
router.get('/', async (req, res) => {
  try {
    if (req.query.for === 'pos') {
      const [rows] = await pool.query(
        `SELECT id, name, slug
         FROM categories
         WHERE is_active = 1 AND parent_id IS NOT NULL
         ORDER BY sort_order ASC, id ASC`
      );
      return res.json({ success: true, data: rows });
    }

    const [rows] = await pool.query(
      `SELECT id, name, slug, parent_id, image_url, sort_order
       FROM categories WHERE is_active = 1
       ORDER BY sort_order ASC, id ASC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /categories/tree — Trả về cấu trúc cây 3 cấp cho Mega Menu
router.get('/tree', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, slug, parent_id, image_url, sort_order
       FROM categories WHERE is_active = 1
       ORDER BY sort_order ASC, id ASC`
    );

    const map = {};
    const tree = [];

    // Bước 1: Khởi tạo tất cả các nút
    rows.forEach(row => {
      map[row.id] = { ...row, children: [] };
    });

    // Bước 2: Liên kết cha-con
    rows.forEach(row => {
      if (row.parent_id && map[row.parent_id]) {
        map[row.parent_id].children.push(map[row.id]);
      } else if (row.parent_id === null || !map[row.parent_id]) {
        // Gốc (Level 1)
        tree.push(map[row.id]);
      }
    });

    res.json({ success: true, data: tree });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /categories/:parent_id/children — Danh sách danh mục con trực tiếp (public)
router.get('/:parent_id/children', async (req, res) => {
  try {
    const parentId = Number(req.params.parent_id);
    if (!Number.isInteger(parentId) || parentId <= 0) {
      return res.status(400).json({ success: false, message: 'parent_id không hợp lệ' });
    }

    const [rows] = await pool.query(
      `SELECT id, name, slug, parent_id, image_url, sort_order
       FROM categories
       WHERE parent_id = ? AND is_active = 1
       ORDER BY sort_order ASC, id ASC`,
      [parentId]
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM categories WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Không tìm thấy danh mục' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', canWriteCatalog, requireFields(['name']), async (req, res) => {
  try {
    const { name, slug, parent_id, description, image_url, sort_order = 0 } = req.body || {};
    if (!name) {
      return res.status(400).json({ success: false, message: 'Thiếu name' });
    }

    const normalizedSlug = toSlug(slug || name);
    if (!normalizedSlug) {
      return res.status(400).json({ success: false, message: 'slug không hợp lệ' });
    }

    if (parent_id !== undefined && parent_id !== null) {
      const [[parent]] = await pool.query(
        `SELECT id FROM categories WHERE id = ? AND is_active = 1`,
        [parent_id]
      );
      if (!parent) {
        return res.status(400).json({ success: false, message: 'parent_id không tồn tại' });
      }
    }

    const [result] = await pool.query(
      `INSERT INTO categories (name, slug, parent_id, description, image_url, sort_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [name, normalizedSlug, parent_id ?? null, description || null, image_url || null, Number(sort_order) || 0]
    );
    res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'slug đã tồn tại' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', canWriteCatalog, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'id không hợp lệ' });
    }

    const [[existing]] = await pool.query(`SELECT id FROM categories WHERE id = ?`, [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy danh mục' });
    }

    const { name, slug, parent_id, description, image_url, sort_order, is_active } = req.body || {};
    const fields = [];
    const params = [];

    if (name !== undefined) { fields.push('name = ?'); params.push(name); }
    if (slug !== undefined) {
      const normalizedSlug = toSlug(slug);
      if (!normalizedSlug) {
        return res.status(400).json({ success: false, message: 'slug không hợp lệ' });
      }
      fields.push('slug = ?');
      params.push(normalizedSlug);
    }
    if (parent_id !== undefined) {
      if (parent_id === id) {
        return res.status(400).json({ success: false, message: 'parent_id không được trùng id hiện tại' });
      }
      if (parent_id !== null) {
        const [[parent]] = await pool.query(
          `SELECT id FROM categories WHERE id = ? AND is_active = 1`,
          [parent_id]
        );
        if (!parent) {
          return res.status(400).json({ success: false, message: 'parent_id không tồn tại' });
        }
      }
      fields.push('parent_id = ?');
      params.push(parent_id);
    }
    if (description !== undefined) { fields.push('description = ?'); params.push(description || null); }
    if (image_url !== undefined) { fields.push('image_url = ?'); params.push(image_url || null); }
    if (sort_order !== undefined) { fields.push('sort_order = ?'); params.push(Number(sort_order) || 0); }
    if (is_active !== undefined) { fields.push('is_active = ?'); params.push(is_active ? 1 : 0); }

    if (!fields.length) {
      return res.status(400).json({ success: false, message: 'Không có trường nào để cập nhật' });
    }

    await pool.query(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`, [...params, id]);
    res.json({ success: true, message: 'Cập nhật danh mục thành công' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'slug đã tồn tại' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', canWriteCatalog, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [result] = await pool.query(
      `UPDATE categories SET is_active = 0 WHERE id = ?`,
      [id]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy danh mục' });
    }
    res.json({ success: true, message: 'Ẩn danh mục thành công' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
