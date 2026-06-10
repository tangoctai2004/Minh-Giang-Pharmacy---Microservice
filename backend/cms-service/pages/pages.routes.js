/**
 * pages.routes.js — Quản lý trang tĩnh CMS
 * (Về chúng tôi, Chính sách bảo mật, Hướng dẫn mua hàng, Điều khoản dịch vụ...)
 *
 * Public:
 *   GET  /pages                 — Danh sách trang active (id, slug, title)
 *   GET  /pages/footer          — Trang hiển thị trong footer
 *   GET  /pages/:slug           — Nội dung trang theo slug
 *
 * Admin:
 *   GET  /pages/admin/:id       — Chi tiết trang (kể cả inactive)
 *   POST /pages                 — Tạo trang mới
 *   PUT  /pages/:id             — Cập nhật trang
 *   DELETE /pages/:id           — Soft delete (is_active = 0)
 */
const router = require('express').Router();
const pool = require('../db/pool');
const requireRoles = require('../middlewares/requireRoles');
const { requireFields } = require('../middlewares/validate');
const { toSlug } = require('../utils/slug');

const canWrite = requireRoles(['admin']);

// ──────────────────────────────────────────────
// PUBLIC
// ──────────────────────────────────────────────

/**
 * GET /pages — Danh sách trang active (chỉ trả meta, không trả content)
 */
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, slug, title, meta_description, show_in_footer, sort_order, published_at
       FROM cms_pages
       WHERE is_active = 1 AND published_at IS NOT NULL
       ORDER BY sort_order ASC, title ASC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /pages/footer — Trang hiển thị trong footer
 */
router.get('/footer', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, slug, title, sort_order
       FROM cms_pages
       WHERE is_active = 1 AND show_in_footer = 1 AND published_at IS NOT NULL
       ORDER BY sort_order ASC, title ASC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /pages/admin/:id — Chi tiết trang (admin, kể cả inactive)
 */
router.get('/admin/:id', canWrite, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.query('SELECT * FROM cms_pages WHERE id = ?', [id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy trang' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /pages/:slug — Nội dung trang theo slug (public)
 */
router.get('/:slug', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, slug, title, content, meta_title, meta_description, meta_keywords,
              featured_image, published_at, updated_at
       FROM cms_pages
       WHERE slug = ? AND is_active = 1 AND published_at IS NOT NULL`,
      [req.params.slug]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy trang' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ──────────────────────────────────────────────
// ADMIN
// ──────────────────────────────────────────────

/**
 * POST /pages — Tạo trang tĩnh mới
 * Body: { title, content, slug?, meta_title?, meta_description?, meta_keywords?,
 *          featured_image?, show_in_footer?, sort_order?, publish? }
 */
router.post(
  '/',
  canWrite,
  requireFields(['title', 'content']),
  async (req, res) => {
    try {
      const {
        title,
        content,
        slug,
        meta_title = null,
        meta_description = null,
        meta_keywords = null,
        featured_image = null,
        show_in_footer = 0,
        sort_order = 0,
        publish = false,   // true → set is_active=1 và published_at=NOW()
      } = req.body;

      const finalSlug = toSlug(slug || title);
      if (!finalSlug) {
        return res.status(400).json({ success: false, message: 'Không thể tạo slug từ tiêu đề đã cho' });
      }

      const isActive = publish ? 1 : 0;
      const publishedAt = publish ? new Date() : null;

      const [result] = await pool.query(
        `INSERT INTO cms_pages
           (slug, title, content, meta_title, meta_description, meta_keywords,
            featured_image, author_id, is_active, show_in_footer, sort_order, published_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          finalSlug, title, content,
          meta_title, meta_description, meta_keywords,
          featured_image,
          req.userId || null,
          isActive,
          show_in_footer ? 1 : 0,
          Number(sort_order) || 0,
          publishedAt,
        ]
      );

      res.status(201).json({ success: true, data: { id: result.insertId, slug: finalSlug } });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ success: false, message: 'Slug trang đã tồn tại' });
      }
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PUT /pages/:id — Cập nhật trang tĩnh (partial update)
 */
router.put('/:id', canWrite, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'id không hợp lệ' });
    }

    const [[existing]] = await pool.query('SELECT id, published_at FROM cms_pages WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy trang' });
    }

    const {
      title, content, slug, meta_title, meta_description, meta_keywords,
      featured_image, show_in_footer, sort_order, is_active, publish
    } = req.body || {};

    const fields = [];
    const params = [];

    if (title !== undefined) { fields.push('title = ?'); params.push(title); }
    if (slug !== undefined) {
      const normalizedSlug = toSlug(slug);
      if (!normalizedSlug) return res.status(400).json({ success: false, message: 'slug không hợp lệ' });
      fields.push('slug = ?'); params.push(normalizedSlug);
    }
    if (content !== undefined) { fields.push('content = ?'); params.push(content); }
    if (meta_title !== undefined) { fields.push('meta_title = ?'); params.push(meta_title || null); }
    if (meta_description !== undefined) { fields.push('meta_description = ?'); params.push(meta_description || null); }
    if (meta_keywords !== undefined) { fields.push('meta_keywords = ?'); params.push(meta_keywords || null); }
    if (featured_image !== undefined) { fields.push('featured_image = ?'); params.push(featured_image || null); }
    if (show_in_footer !== undefined) { fields.push('show_in_footer = ?'); params.push(show_in_footer ? 1 : 0); }
    if (sort_order !== undefined) { fields.push('sort_order = ?'); params.push(Number(sort_order) || 0); }
    if (is_active !== undefined) { fields.push('is_active = ?'); params.push(is_active ? 1 : 0); }

    // Publish action: lần đầu publish → set published_at
    if (publish && !existing.published_at) {
      fields.push('published_at = NOW()');
      fields.push('is_active = 1');
      fields.push('published_by = ?'); params.push(req.userId || null);
    }

    if (!fields.length) {
      return res.status(400).json({ success: false, message: 'Không có trường nào để cập nhật' });
    }

    await pool.query(`UPDATE cms_pages SET ${fields.join(', ')} WHERE id = ?`, [...params, id]);
    res.json({ success: true, message: 'Cập nhật trang thành công' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Slug đã tồn tại' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * DELETE /pages/:id — Soft delete
 */
router.delete('/:id', canWrite, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [result] = await pool.query(
      'UPDATE cms_pages SET is_active = 0 WHERE id = ? AND is_active = 1',
      [id]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy trang hoặc đã bị ẩn' });
    }
    res.json({ success: true, message: 'Trang đã bị ẩn thành công' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
