/**
 * trending-searches.routes.js — Quản lý từ khoá tìm kiếm phổ biến
 *
 * Public:
 *   GET  /trending-searches              — Top trending keywords (hot search suggestions)
 *   POST /trending-searches/track        — Ghi nhận lượt tìm kiếm (upsert)
 *
 * Admin:
 *   GET  /trending-searches/admin        — Tất cả keyword (gồm cả hidden)
 *   PUT  /trending-searches/:id/pin      — Ghim/bỏ ghim keyword
 *   PUT  /trending-searches/:id/hide     — Ẩn/hiện keyword
 *   DELETE /trending-searches/:id        — Xoá keyword
 */
const router = require('express').Router();
const pool = require('../db/pool');
const requireRoles = require('../middlewares/requireRoles');

const CONTEXTS = ['global', 'product', 'disease', 'article'];
const canWrite = requireRoles(['admin']);

// ──────────────────────────────────────────────
// PUBLIC
// ──────────────────────────────────────────────

/**
 * GET /trending-searches
 * Trả về top N từ khoá: ghim trước, rồi sắp xếp theo search_count
 * Query params:
 *   ?context=global|product|disease|article   — ngữ cảnh
 *   ?limit=10                                  — số kết quả (max 30)
 */
router.get('/', async (req, res) => {
  try {
    const { context = 'global', limit = 10 } = req.query;
    const queryLimit = Math.min(30, Math.max(1, Number(limit) || 10));

    if (!CONTEXTS.includes(context)) {
      return res.status(400).json({
        success: false,
        message: `context không hợp lệ. Giá trị cho phép: ${CONTEXTS.join(', ')}`,
      });
    }

    // Lấy kỳ thống kê hiện tại (30 ngày gần nhất)
    const [rows] = await pool.query(
      `SELECT id, keyword, search_count, distinct_users, is_pinned, last_searched
       FROM trending_searches
       WHERE context = ?
         AND is_hidden = 0
         AND period_end >= CURDATE() - INTERVAL 30 DAY
       ORDER BY
         is_pinned DESC,
         pin_order ASC,
         search_count DESC
       LIMIT ?`,
      [context, queryLimit]
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /trending-searches/track — Ghi nhận lượt tìm kiếm
 * Body: { keyword, context? }
 * Upsert: nếu keyword đã có trong kỳ hiện tại → tăng search_count
 */
router.post('/track', async (req, res) => {
  try {
    const { keyword, context = 'global' } = req.body || {};

    if (!keyword || !keyword.trim()) {
      return res.status(400).json({ success: false, message: 'keyword không được để trống' });
    }
    if (!CONTEXTS.includes(context)) {
      return res.status(400).json({ success: false, message: `context không hợp lệ: ${CONTEXTS.join(', ')}` });
    }

    // Normalize keyword: lowercase, trim
    const normalizedKeyword = keyword.trim().toLowerCase().substring(0, 300);

    // Kỳ thống kê hiện tại: đầu tháng → cuối tháng
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

    // Upsert: tăng search_count nếu đã tồn tại trong kỳ, ngược lại insert mới
    await pool.query(
      `INSERT INTO trending_searches
         (keyword, context, search_count, distinct_users, period_start, period_end, last_searched)
       VALUES (?, ?, 1, 1, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         search_count = search_count + 1,
         last_searched = NOW()`,
      [normalizedKeyword, context, periodStart, periodEnd]
    );

    res.json({ success: true, message: 'Đã ghi nhận lượt tìm kiếm' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ──────────────────────────────────────────────
// ADMIN ROUTES
// ──────────────────────────────────────────────

/**
 * GET /trending-searches/admin — Tất cả keyword (gồm cả hidden)
 * Query params: ?context=, ?is_pinned=, ?is_hidden=, ?page=, ?limit=
 */
router.get('/admin', canWrite, async (req, res) => {
  try {
    const { context, is_pinned, is_hidden, page = 1, limit = 20 } = req.query;
    const offset = (Math.max(1, Number(page)) - 1) * Math.min(50, Number(limit) || 20);
    const pageLimit = Math.min(50, Number(limit) || 20);

    const conditions = [];
    const params = [];

    if (context && CONTEXTS.includes(context)) { conditions.push('context = ?'); params.push(context); }
    if (is_pinned !== undefined) { conditions.push('is_pinned = ?'); params.push(is_pinned === '1' ? 1 : 0); }
    if (is_hidden !== undefined) { conditions.push('is_hidden = ?'); params.push(is_hidden === '1' ? 1 : 0); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM trending_searches ${where}`, params
    );

    const [rows] = await pool.query(
      `SELECT id, keyword, context, search_count, distinct_users,
              is_pinned, pin_order, is_hidden, period_start, period_end, last_searched
       FROM trending_searches ${where}
       ORDER BY search_count DESC
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
 * PUT /trending-searches/:id/pin — Ghim/bỏ ghim keyword
 * Body: { is_pinned: true|false, pin_order?: number }
 */
router.put('/:id/pin', canWrite, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { is_pinned, pin_order = 0 } = req.body || {};

    if (is_pinned === undefined) {
      return res.status(400).json({ success: false, message: 'is_pinned là bắt buộc' });
    }

    const [[existing]] = await pool.query('SELECT id FROM trending_searches WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy keyword' });
    }

    await pool.query(
      'UPDATE trending_searches SET is_pinned = ?, pin_order = ? WHERE id = ?',
      [is_pinned ? 1 : 0, Number(pin_order) || 0, id]
    );

    res.json({
      success: true,
      message: is_pinned ? 'Đã ghim keyword' : 'Đã bỏ ghim keyword',
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /trending-searches/:id/hide — Ẩn/hiện keyword
 * Body: { is_hidden: true|false }
 */
router.put('/:id/hide', canWrite, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { is_hidden } = req.body || {};

    if (is_hidden === undefined) {
      return res.status(400).json({ success: false, message: 'is_hidden là bắt buộc' });
    }

    const [[existing]] = await pool.query('SELECT id FROM trending_searches WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy keyword' });
    }

    await pool.query(
      'UPDATE trending_searches SET is_hidden = ? WHERE id = ?',
      [is_hidden ? 1 : 0, id]
    );

    res.json({
      success: true,
      message: is_hidden ? 'Đã ẩn keyword khỏi hot search' : 'Đã hiện keyword trong hot search',
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * DELETE /trending-searches/:id — Xoá vĩnh viễn keyword
 */
router.delete('/:id', canWrite, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [result] = await pool.query('DELETE FROM trending_searches WHERE id = ?', [id]);
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy keyword' });
    }
    res.json({ success: true, message: 'Đã xoá keyword thành công' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
