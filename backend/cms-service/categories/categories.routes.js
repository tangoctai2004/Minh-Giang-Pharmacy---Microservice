/**
 * categories.routes.js — Quản lý danh mục CMS
 *
 * QUAN TRỌNG: Table thực tế là `cms_categories` (KHÔNG phải `disease_categories`)
 * Field `type` phân loại: 'article' | 'disease' | 'promotion'
 *
 * Public:
 *   GET  /categories            — Danh sách (có thể lọc theo type)
 *   GET  /categories/tree       — Cây phân cấp (parent → children)
 *   GET  /categories/:id        — Chi tiết 1 danh mục
 *
 * Admin/Manager:
 *   POST   /categories          — Tạo danh mục mới
 *   PUT    /categories/:id      — Cập nhật danh mục
 *   DELETE /categories/:id      — Soft delete (is_active = 0)
 */
const router = require('express').Router();
const pool = require('../db/pool');
const requireRoles = require('../middlewares/requireRoles');
const { requireFields, validateEnum } = require('../middlewares/validate');
const { toSlug } = require('../utils/slug');

const CATEGORY_TYPES = ['article', 'disease', 'promotion'];
const canWrite = requireRoles(['admin', 'manager']);

// ──────────────────────────────────────────────
// PUBLIC
// ──────────────────────────────────────────────

/**
 * GET /categories
 * Query params:
 *   ?type=article|disease|promotion  — lọc theo loại danh mục
 *   ?parent_id=                      — lọc theo danh mục cha (NULL → root)
 */
router.get('/', async (req, res) => {
  try {
    const { type, parent_id } = req.query;

    const conditions = ['is_active = 1'];
    const params = [];

    if (type) {
      if (!CATEGORY_TYPES.includes(type)) {
        return res.status(400).json({
          success: false,
          message: `type không hợp lệ. Giá trị cho phép: ${CATEGORY_TYPES.join(', ')}`,
        });
      }
      conditions.push('type = ?');
      params.push(type);
    }

    if (parent_id !== undefined) {
      if (parent_id === 'null' || parent_id === '') {
        conditions.push('parent_id IS NULL');
      } else {
        conditions.push('parent_id = ?');
        params.push(Number(parent_id));
      }
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await pool.query(
      `SELECT id, name, slug, type, parent_id, description, image_url, sort_order
       FROM cms_categories ${where}
       ORDER BY sort_order ASC, name ASC`,
      params
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /categories/tree — Cây phân cấp (dùng cho menu, sidebar)
 * Trả về mảng root categories, mỗi root có `children[]`
 */
router.get('/tree', async (req, res) => {
  try {
    const { type } = req.query;
    const conditions = ['is_active = 1'];
    const params = [];

    if (type && CATEGORY_TYPES.includes(type)) {
      conditions.push('type = ?');
      params.push(type);
    }

    const [rows] = await pool.query(
      `SELECT id, name, slug, type, parent_id, description, image_url, sort_order
       FROM cms_categories
       WHERE ${conditions.join(' AND ')}
       ORDER BY sort_order ASC, name ASC`,
      params
    );

    // Build cây
    const map = {};
    rows.forEach(row => { map[row.id] = { ...row, children: [] }; });

    const tree = [];
    rows.forEach(row => {
      if (row.parent_id && map[row.parent_id]) {
        map[row.parent_id].children.push(map[row.id]);
      } else {
        tree.push(map[row.id]);
      }
    });

    res.json({ success: true, data: tree });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /categories/:id — Chi tiết danh mục
 */
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM cms_categories WHERE id = ? AND is_active = 1',
      [req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy danh mục' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ──────────────────────────────────────────────
// ADMIN / MANAGER
// ──────────────────────────────────────────────

/**
 * POST /categories — Tạo danh mục mới
 * Body: { name, type, slug?, parent_id?, description?, image_url?, sort_order? }
 */
router.post(
  '/',
  canWrite,
  requireFields(['name', 'type']),
  validateEnum('type', CATEGORY_TYPES),
  async (req, res) => {
    try {
      const {
        name,
        type,
        slug,
        parent_id = null,
        description = null,
        image_url = null,
        sort_order = 0,
      } = req.body;

      const finalSlug = toSlug(slug || name);
      if (!finalSlug) {
        return res.status(400).json({ success: false, message: 'Không thể tạo slug từ tên đã cho' });
      }

      // Validate parent tồn tại
      if (parent_id !== null && parent_id !== undefined) {
        const [[parent]] = await pool.query(
          'SELECT id FROM cms_categories WHERE id = ? AND is_active = 1',
          [Number(parent_id)]
        );
        if (!parent) {
          return res.status(400).json({ success: false, message: 'parent_id không tồn tại' });
        }
      }

      const [result] = await pool.query(
        `INSERT INTO cms_categories (name, slug, type, parent_id, description, image_url, is_active, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
        [name, finalSlug, type, parent_id || null, description, image_url, Number(sort_order) || 0]
      );

      res.status(201).json({ success: true, data: { id: result.insertId, slug: finalSlug } });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ success: false, message: 'Slug danh mục đã tồn tại' });
      }
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PUT /categories/:id — Cập nhật danh mục (partial update)
 */
router.put(
  '/:id',
  canWrite,
  validateEnum('type', CATEGORY_TYPES),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ success: false, message: 'id không hợp lệ' });
      }

      const [[existing]] = await pool.query('SELECT id FROM cms_categories WHERE id = ?', [id]);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy danh mục' });
      }

      const { name, slug, type, parent_id, description, image_url, sort_order, is_active } = req.body || {};
      const fields = [];
      const params = [];

      if (name !== undefined) { fields.push('name = ?'); params.push(name); }

      if (slug !== undefined) {
        const normalizedSlug = toSlug(slug);
        if (!normalizedSlug) return res.status(400).json({ success: false, message: 'slug không hợp lệ' });
        fields.push('slug = ?'); params.push(normalizedSlug);
      }

      if (type !== undefined) { fields.push('type = ?'); params.push(type); }

      if (parent_id !== undefined) {
        if (parent_id === id) {
          return res.status(400).json({ success: false, message: 'parent_id không được trùng với id danh mục hiện tại' });
        }
        if (parent_id !== null) {
          const [[parent]] = await pool.query(
            'SELECT id FROM cms_categories WHERE id = ? AND is_active = 1',
            [Number(parent_id)]
          );
          if (!parent) return res.status(400).json({ success: false, message: 'parent_id không tồn tại' });
        }
        fields.push('parent_id = ?'); params.push(parent_id || null);
      }

      if (description !== undefined) { fields.push('description = ?'); params.push(description || null); }
      if (image_url !== undefined) { fields.push('image_url = ?'); params.push(image_url || null); }
      if (sort_order !== undefined) { fields.push('sort_order = ?'); params.push(Number(sort_order) || 0); }
      if (is_active !== undefined) { fields.push('is_active = ?'); params.push(is_active ? 1 : 0); }

      if (!fields.length) {
        return res.status(400).json({ success: false, message: 'Không có trường nào để cập nhật' });
      }

      await pool.query(`UPDATE cms_categories SET ${fields.join(', ')} WHERE id = ?`, [...params, id]);
      res.json({ success: true, message: 'Cập nhật danh mục thành công' });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ success: false, message: 'Slug đã tồn tại' });
      }
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * DELETE /categories/:id — Soft delete
 */
router.delete('/:id', canWrite, async (req, res) => {
  try {
    const id = Number(req.params.id);

    // Kiểm tra còn bài viết đang dùng danh mục này không
    const [[{ cnt }]] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM articles WHERE category_id = ? AND status != 'archived'`,
      [id]
    );
    if (cnt > 0) {
      return res.status(400).json({
        success: false,
        message: `Không thể ẩn danh mục vì còn ${cnt} bài viết đang sử dụng. Hãy chuyển bài viết sang danh mục khác trước.`,
      });
    }

    const [result] = await pool.query(
      'UPDATE cms_categories SET is_active = 0 WHERE id = ? AND is_active = 1',
      [id]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy danh mục hoặc đã bị ẩn' });
    }
    res.json({ success: true, message: 'Danh mục đã bị ẩn thành công' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
