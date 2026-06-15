/**
 * banners.routes.js — Quản lý banner quảng cáo
 *
 * QUAN TRỌNG: Schema dùng column `position` (KHÔNG phải `placement`)
 * Enum position: 'hero' | 'popup' | 'sidebar'
 *
 * Public:
 *   GET  /banners            — Danh sách banner đang active
 *
 * Admin only:
 *   POST   /banners          — Tạo banner mới
 *   PUT    /banners/:id      — Cập nhật banner
 *   DELETE /banners/:id      — Soft delete (is_active = 0)
 */
const router = require('express').Router();
const pool = require('../db/pool');
const requireRoles = require('../middlewares/requireRoles');
const { requireFields, validateEnum } = require('../middlewares/validate');

const POSITIONS = ['hero', 'popup', 'sidebar'];
const canWrite = requireRoles(['admin']);

// ──────────────────────────────────────────────
// PUBLIC
// ──────────────────────────────────────────────

/**
 * GET /banners
 * Query params:
 *   ?position=hero|popup|sidebar   — lọc theo vị trí
 * Chỉ trả về banner active VÀ còn trong khoảng thời gian hiển thị
 */
router.get('/', async (req, res) => {
  try {
    const { position } = req.query;

    let sql = `
      SELECT id, title, image_url, link_url, position, sort_order, start_date, end_date
      FROM banners
      WHERE is_active = 1
        AND (start_date IS NULL OR start_date <= CURDATE())
        AND (end_date   IS NULL OR end_date   >= CURDATE())
    `;
    const params = [];

    if (position) {
      if (!POSITIONS.includes(position)) {
        return res.status(400).json({
          success: false,
          message: `position không hợp lệ. Giá trị cho phép: ${POSITIONS.join(', ')}`,
        });
      }
      sql += ' AND position = ?';
      params.push(position);
    }

    sql += ' ORDER BY sort_order ASC, id ASC';

    const [rows] = await pool.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ──────────────────────────────────────────────
// ADMIN ROUTES
// ──────────────────────────────────────────────

/**
 * GET /banners/admin — Admin: tất cả banner (gồm cả inactive)
 */
router.get('/admin', canWrite, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, title, image_url, link_url, position, is_active,
              start_date, end_date, sort_order
       FROM banners
       ORDER BY sort_order ASC, id ASC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /banners — Tạo banner mới
 * Body: { title, image_url, position, link_url?, start_date?, end_date?, sort_order? }
 */
router.post(
  '/',
  canWrite,
  requireFields(['title', 'image_url', 'position']),
  validateEnum('position', POSITIONS),
  async (req, res) => {
    try {
      const {
        title,
        image_url,
        position,
        link_url = null,
        start_date = null,
        end_date = null,
        sort_order = 0,
      } = req.body;

      // Validate date range nếu cả hai đều có
      if (start_date && end_date && new Date(start_date) > new Date(end_date)) {
        return res.status(400).json({ success: false, message: 'start_date phải nhỏ hơn end_date' });
      }

      const [result] = await pool.query(
        `INSERT INTO banners (title, image_url, link_url, position, is_active, start_date, end_date, sort_order)
         VALUES (?, ?, ?, ?, 1, ?, ?, ?)`,
        [title, image_url, link_url, position, start_date || null, end_date || null, Number(sort_order) || 0]
      );

      res.status(201).json({ success: true, data: { id: result.insertId } });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PUT /banners/:id — Cập nhật banner (partial update)
 */
router.put(
  '/:id',
  canWrite,
  validateEnum('position', POSITIONS),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ success: false, message: 'id không hợp lệ' });
      }

      const [[existing]] = await pool.query('SELECT id FROM banners WHERE id = ?', [id]);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy banner' });
      }

      const { title, image_url, link_url, position, is_active, start_date, end_date, sort_order } = req.body || {};
      const fields = [];
      const params = [];

      if (title !== undefined) { fields.push('title = ?'); params.push(title); }
      if (image_url !== undefined) { fields.push('image_url = ?'); params.push(image_url); }
      if (link_url !== undefined) { fields.push('link_url = ?'); params.push(link_url || null); }
      if (position !== undefined) { fields.push('position = ?'); params.push(position); }
      if (is_active !== undefined) { fields.push('is_active = ?'); params.push(is_active ? 1 : 0); }
      if (start_date !== undefined) { fields.push('start_date = ?'); params.push(start_date || null); }
      if (end_date !== undefined) { fields.push('end_date = ?'); params.push(end_date || null); }
      if (sort_order !== undefined) { fields.push('sort_order = ?'); params.push(Number(sort_order) || 0); }

      if (!fields.length) {
        return res.status(400).json({ success: false, message: 'Không có trường nào để cập nhật' });
      }

      await pool.query(`UPDATE banners SET ${fields.join(', ')} WHERE id = ?`, [...params, id]);
      res.json({ success: true, message: 'Cập nhật banner thành công' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * DELETE /banners/:id — Soft delete (ẩn banner, không xoá vĩnh viễn)
 */
router.delete('/:id', canWrite, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [result] = await pool.query(
      'UPDATE banners SET is_active = 0 WHERE id = ? AND is_active = 1',
      [id]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy banner hoặc đã bị ẩn' });
    }
    res.json({ success: true, message: 'Banner đã bị ẩn thành công' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
