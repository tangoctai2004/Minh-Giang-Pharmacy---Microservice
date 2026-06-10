/**
 * articles.routes.js — CRUD bài viết sức khoẻ của Nhà thuốc Minh Giang
 *
 * Public:
 *   GET  /articles              — Danh sách bài đã publish, hỗ trợ filter/pagination
 *   GET  /articles/:idOrSlug    — Chi tiết bài viết (tăng view_count)
 *
 * Admin/Manager only:
 *   GET  /articles/admin        — Tất cả bài (gồm draft/archived)
 *   POST /articles              — Tạo bài mới
 *   PUT  /articles/:id          — Cập nhật bài
 *   DELETE /articles/:id        — Soft delete (chuyển sang archived)
 */
const router = require('express').Router();
const pool = require('../db/pool');
const requireRoles = require('../middlewares/requireRoles');
const { requireFields, validateEnum } = require('../middlewares/validate');
const { toSlug, sanitizeHtml } = require('../utils/slug');

const canWrite = requireRoles(['admin', 'manager']);

// ──────────────────────────────────────────────
// PUBLIC ROUTES
// ──────────────────────────────────────────────

/**
 * GET /articles
 * Query params:
 *   ?category_id=1    — lọc theo danh mục
 *   ?q=từ khoá       — fulltext search trên title, excerpt
 *   ?page=1&limit=12  — phân trang
 *   ?tags=benh-gut    — lọc theo tag
 */
router.get('/', async (req, res) => {
  try {
    const { category_id, q, tags, page = 1, limit = 12 } = req.query;
    const offset = (Math.max(1, Number(page)) - 1) * Math.min(50, Number(limit) || 12);
    const pageLimit = Math.min(50, Number(limit) || 12);

    let conditions = [`a.status = 'published'`, `a.published_at <= NOW()`];
    const params = [];

    if (category_id) {
      conditions.push('a.category_id = ?');
      params.push(Number(category_id));
    }

    if (q && q.trim()) {
      conditions.push('MATCH(a.title, a.excerpt) AGAINST(? IN BOOLEAN MODE)');
      params.push(`${q.trim()}*`);
    }

    if (tags) {
      conditions.push('JSON_CONTAINS(a.tags, ?)');
      params.push(JSON.stringify(tags));
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count tổng để trả về meta pagination
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM articles a
       ${where}`,
      params
    );

    const [rows] = await pool.query(
      `SELECT a.id, a.title, a.slug, a.thumbnail_url, a.excerpt,
              a.view_count, a.published_at, a.category_id,
              c.name AS category_name, c.slug AS category_slug
       FROM articles a
       LEFT JOIN cms_categories c ON c.id = a.category_id
       ${where}
       ORDER BY a.published_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageLimit, offset]
    );

    res.json({
      success: true,
      data: rows,
      meta: {
        total: Number(total),
        page: Number(page),
        limit: pageLimit,
        total_pages: Math.ceil(Number(total) / pageLimit),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /articles/admin — Danh sách tất cả bài (admin/manager)
 * Query params: ?status=draft|published|archived, ?category_id=, ?page=, ?limit=
 */
router.get('/admin', canWrite, async (req, res) => {
  try {
    const { status, category_id, page = 1, limit = 20 } = req.query;
    const offset = (Math.max(1, Number(page)) - 1) * Math.min(50, Number(limit) || 20);
    const pageLimit = Math.min(50, Number(limit) || 20);

    const conditions = [];
    const params = [];

    if (status && ['draft', 'published', 'archived'].includes(status)) {
      conditions.push('a.status = ?');
      params.push(status);
    }
    if (category_id) {
      conditions.push('a.category_id = ?');
      params.push(Number(category_id));
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM articles a ${where}`, params
    );

    const [rows] = await pool.query(
      `SELECT a.id, a.title, a.slug, a.status, a.view_count,
              a.published_at, a.created_at, a.updated_at, a.category_id,
              a.author_id, c.name AS category_name
       FROM articles a
       LEFT JOIN cms_categories c ON c.id = a.category_id
       ${where}
       ORDER BY a.updated_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageLimit, offset]
    );

    res.json({
      success: true,
      data: rows,
      meta: {
        total: Number(total),
        page: Number(page),
        limit: pageLimit,
        total_pages: Math.ceil(Number(total) / pageLimit),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /articles/:idOrSlug — Chi tiết bài viết
 * Hỗ trợ cả id (số) và slug (chuỗi)
 * Trả về content_sanitized (không trả content thô — bảo mật XSS)
 */
router.get('/:idOrSlug', async (req, res) => {
  try {
    const param = req.params.idOrSlug;
    const col = /^\d+$/.test(param) ? 'a.id' : 'a.slug';

    const [rows] = await pool.query(
      `SELECT a.id, a.title, a.slug, a.thumbnail_url,
              COALESCE(a.content_sanitized, a.content) AS content,
              a.excerpt, a.tags, a.view_count, a.published_at,
              a.category_id, a.author_id,
              c.name AS category_name, c.slug AS category_slug
       FROM articles a
       LEFT JOIN cms_categories c ON c.id = a.category_id
       WHERE ${col} = ? AND a.status = 'published'`,
      [param]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết' });
    }

    // Tăng view_count bất đồng bộ (không block response)
    pool.query('UPDATE articles SET view_count = view_count + 1 WHERE id = ?', [rows[0].id])
      .catch(() => {});

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ──────────────────────────────────────────────
// ADMIN / MANAGER ROUTES
// ──────────────────────────────────────────────

/**
 * POST /articles — Tạo bài viết mới
 * Body: { title, content, category_id, excerpt?, thumbnail_url?, tags?, status?, slug? }
 */
router.post(
  '/',
  canWrite,
  requireFields(['title', 'content', 'category_id']),
  validateEnum('status', ['draft', 'published', 'archived']),
  async (req, res) => {
    try {
      const {
        title,
        content,
        category_id,
        excerpt = null,
        thumbnail_url = null,
        tags = null,
        status = 'draft',
        slug,
      } = req.body;

      // Validate category tồn tại
      const [[cat]] = await pool.query(
        'SELECT id FROM cms_categories WHERE id = ? AND is_active = 1',
        [Number(category_id)]
      );
      if (!cat) {
        return res.status(400).json({ success: false, message: 'category_id không tồn tại' });
      }

      const finalSlug = toSlug(slug || title);
      if (!finalSlug) {
        return res.status(400).json({ success: false, message: 'Không thể tạo slug từ tiêu đề đã cho' });
      }

      const sanitized = sanitizeHtml(content);
      const publishedAt = status === 'published' ? new Date() : null;

      const [result] = await pool.query(
        `INSERT INTO articles
           (title, slug, content, content_sanitized, sanitized_at,
            excerpt, thumbnail_url, category_id, author_id,
            tags, status, published_at)
         VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?)`,
        [
          title,
          finalSlug,
          content,
          sanitized,
          excerpt,
          thumbnail_url,
          Number(category_id),
          req.userId || null,
          tags ? JSON.stringify(tags) : null,
          status,
          publishedAt,
        ]
      );

      res.status(201).json({ success: true, data: { id: result.insertId, slug: finalSlug } });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ success: false, message: 'Slug đã tồn tại, hãy dùng tiêu đề khác hoặc đặt slug thủ công' });
      }
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PUT /articles/:id — Cập nhật bài viết
 * Hỗ trợ partial update — chỉ cập nhật các trường được gửi lên
 */
router.put(
  '/:id',
  canWrite,
  validateEnum('status', ['draft', 'published', 'archived']),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ success: false, message: 'id không hợp lệ' });
      }

      const [[existing]] = await pool.query('SELECT id, status, published_at FROM articles WHERE id = ?', [id]);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết' });
      }

      const { title, content, slug, excerpt, thumbnail_url, category_id, tags, status } = req.body || {};
      const fields = [];
      const params = [];

      if (title !== undefined) { fields.push('title = ?'); params.push(title); }

      if (slug !== undefined) {
        const normalizedSlug = toSlug(slug);
        if (!normalizedSlug) return res.status(400).json({ success: false, message: 'slug không hợp lệ' });
        fields.push('slug = ?'); params.push(normalizedSlug);
      }

      if (content !== undefined) {
        fields.push('content = ?'); params.push(content);
        fields.push('content_sanitized = ?'); params.push(sanitizeHtml(content));
        fields.push('sanitized_at = NOW()');
      }

      if (excerpt !== undefined) { fields.push('excerpt = ?'); params.push(excerpt || null); }
      if (thumbnail_url !== undefined) { fields.push('thumbnail_url = ?'); params.push(thumbnail_url || null); }
      if (tags !== undefined) { fields.push('tags = ?'); params.push(tags ? JSON.stringify(tags) : null); }

      if (category_id !== undefined) {
        const [[cat]] = await pool.query(
          'SELECT id FROM cms_categories WHERE id = ? AND is_active = 1',
          [Number(category_id)]
        );
        if (!cat) return res.status(400).json({ success: false, message: 'category_id không tồn tại' });
        fields.push('category_id = ?'); params.push(Number(category_id));
      }

      if (status !== undefined) {
        fields.push('status = ?'); params.push(status);
        // Lần đầu publish → set published_at
        if (status === 'published' && !existing.published_at) {
          fields.push('published_at = NOW()');
        }
      }

      if (!fields.length) {
        return res.status(400).json({ success: false, message: 'Không có trường nào để cập nhật' });
      }

      await pool.query(`UPDATE articles SET ${fields.join(', ')} WHERE id = ?`, [...params, id]);
      res.json({ success: true, message: 'Cập nhật bài viết thành công' });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ success: false, message: 'Slug đã tồn tại' });
      }
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * DELETE /articles/:id — Soft delete (chuyển sang archived, không xoá vĩnh viễn)
 */
router.delete('/:id', canWrite, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [result] = await pool.query(
      `UPDATE articles SET status = 'archived' WHERE id = ? AND status != 'archived'`,
      [id]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết hoặc đã archived' });
    }
    res.json({ success: true, message: 'Bài viết đã được lưu trữ (archived)' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
