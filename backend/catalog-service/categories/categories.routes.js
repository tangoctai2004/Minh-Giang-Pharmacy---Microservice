const router = require('express').Router();
const pool = require('../db/pool');
const requireRoles = require('../middlewares/requireRoles');
const { requireFields } = require('../middlewares/validate');
const cache = require('../utils/cache');

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
    const cacheKey = req.query.for === 'pos' ? 'categories:list:pos' : 'categories:list:default';
    const cachedData = await cache.get(cacheKey);
    if (cachedData) {
      return res.json({ success: true, data: cachedData });
    }

    if (req.query.for === 'pos') {
      const [rows] = await pool.query(
        `SELECT id, name, slug
         FROM categories
         WHERE is_active = 1 AND parent_id IS NOT NULL
         ORDER BY sort_order ASC, id ASC`
      );
      await cache.set(cacheKey, rows, 600); // cache 10 phút
      return res.json({ success: true, data: rows });
    }

    const [rows] = await pool.query(
      `SELECT id, name, slug, parent_id, image_url, sort_order
       FROM categories WHERE is_active = 1
       ORDER BY sort_order ASC, id ASC`
    );
    await cache.set(cacheKey, rows, 600); // cache 10 phút
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /categories/tree — Trả về cấu trúc cây 3 cấp cho Mega Menu
router.get('/tree', async (req, res) => {
  try {
    const cacheKey = 'categories:tree';
    const cachedData = await cache.get(cacheKey);
    if (cachedData) {
      return res.json({ success: true, data: cachedData });
    }

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

    await cache.set(cacheKey, tree, 600); // cache 10 phút
    res.json({ success: true, data: tree });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /categories/pos-tree — Cây danh mục gọn cho POS, kèm số thuốc và số còn hàng
router.get('/pos-tree', async (_req, res) => {
  try {
    const cacheKey = 'categories:pos-tree';
    const cachedData = await cache.get(cacheKey);
    if (cachedData) {
      return res.json({ success: true, data: cachedData });
    }

    const [rows] = await pool.query(
      `SELECT id, name, slug, parent_id, image_url, sort_order
       FROM categories
       WHERE is_active = 1
       ORDER BY sort_order ASC, id ASC`
    );

    const [counts] = await pool.query(
      `SELECT p.category_id,
              COUNT(DISTINCT p.id) AS product_count,
              COUNT(DISTINCT CASE
                WHEN stock.available_stock > 0 THEN p.id
                ELSE NULL
              END) AS in_stock_count
       FROM products p
       LEFT JOIN (
         SELECT bi.product_id,
                COALESCE(SUM(CASE
                  WHEN bi.status IN ('available', 'near_expiry')
                  THEN GREATEST(
                    bi.quantity_remaining - COALESCE((
                      SELECT SUM(sr.quantity)
                      FROM stock_reservations sr
                      WHERE sr.batch_item_id = bi.id
                        AND sr.released_at IS NULL
                        AND sr.expires_at > NOW()
                    ), 0),
                    0
                  )
                  ELSE 0
                END), 0) AS available_stock
         FROM batch_items bi
         GROUP BY bi.product_id
       ) stock ON stock.product_id = p.id
       WHERE p.status = 'active'
       GROUP BY p.category_id`
    );

    const countByCategoryId = counts.reduce((acc, row) => {
      acc[row.category_id] = {
        product_count: Number(row.product_count || 0),
        in_stock_count: Number(row.in_stock_count || 0),
      };
      return acc;
    }, {});

    const map = {};
    const tree = [];
    rows.forEach((row) => {
      const ownCounts = countByCategoryId[row.id] || { product_count: 0, in_stock_count: 0 };
      map[row.id] = {
        ...row,
        product_count: ownCounts.product_count,
        in_stock_count: ownCounts.in_stock_count,
        children: []
      };
    });

    rows.forEach((row) => {
      if (row.parent_id && map[row.parent_id]) {
        map[row.parent_id].children.push(map[row.id]);
      } else if (row.parent_id === null || !map[row.parent_id]) {
        tree.push(map[row.id]);
      }
    });

    const rollupCounts = (node) => {
      node.children.forEach(rollupCounts);
      node.product_count += node.children.reduce((sum, child) => sum + child.product_count, 0);
      node.in_stock_count += node.children.reduce((sum, child) => sum + child.in_stock_count, 0);
    };
    tree.forEach(rollupCounts);

    const responseData = tree.filter((node) => node.product_count > 0);
    const result = {
      success: true,
      data: responseData,
      meta: {
        total_roots: tree.length,
        visible_roots: responseData.length
      }
    };

    await cache.set(cacheKey, responseData, 300); // cache 5 phút
    res.json(result);
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

    const cacheKey = `categories:children:${parentId}`;
    const cachedData = await cache.get(cacheKey);
    if (cachedData) {
      return res.json({ success: true, data: cachedData });
    }

    const [rows] = await pool.query(
      `SELECT id, name, slug, parent_id, image_url, sort_order
       FROM categories
       WHERE parent_id = ? AND is_active = 1
       ORDER BY sort_order ASC, id ASC`,
      [parentId]
    );

    await cache.set(cacheKey, rows, 600); // cache 10 phút
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const categoryId = req.params.id;
    const cacheKey = `categories:id:${categoryId}`;
    const cachedData = await cache.get(cacheKey);
    if (cachedData) {
      return res.json({ success: true, data: cachedData });
    }

    const [rows] = await pool.query('SELECT * FROM categories WHERE id = ?', [categoryId]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Không tìm thấy danh mục' });
    
    await cache.set(cacheKey, rows[0], 600); // cache 10 phút
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

    // Invalidate cache
    await cache.clearByPrefix('categories:');

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

    // Invalidate cache
    await cache.clearByPrefix('categories:');

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

    // Invalidate cache
    await cache.clearByPrefix('categories:');

    res.json({ success: true, message: 'Ẩn danh mục thành công' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
