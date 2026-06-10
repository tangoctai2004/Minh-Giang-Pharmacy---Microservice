/**
 * promotions.routes.js — Quản lý chương trình khuyến mãi & voucher
 *
 * QUAN TRỌNG: Schema dùng column `type` (KHÔNG phải `promotion_type`)
 * Enum type: 'percent_discount' | 'fixed_discount' | 'free_shipping' | 'buy_x_get_y'
 *
 * Public:
 *   GET  /promotions/active          — KM đang chạy (không cần mã)
 *   GET  /promotions/validate/:code  — Validate mã voucher khi checkout
 *
 * Admin:
 *   GET  /promotions               — Tất cả KM (có pagination)
 *   GET  /promotions/:id           — Chi tiết KM
 *   POST /promotions               — Tạo KM mới
 *   PUT  /promotions/:id           — Cập nhật KM
 *   DELETE /promotions/:id         — Soft delete (is_active = 0)
 */
const router = require('express').Router();
const pool = require('../db/pool');
const requireRoles = require('../middlewares/requireRoles');
const { requireFields, validateEnum, validateNumberRange, validateDateWindow } = require('../middlewares/validate');

const PROMO_TYPES = ['percent_discount', 'fixed_discount', 'free_shipping', 'buy_x_get_y'];
const APPLICABLE_TO = ['all', 'specific_categories', 'specific_products'];
const canWrite = requireRoles(['admin']);

// ──────────────────────────────────────────────
// PUBLIC ROUTES (không cần auth)
// ──────────────────────────────────────────────

/**
 * GET /promotions/active
 * Trả về tất cả KM đang chạy tự động (không cần nhập mã)
 */
router.get('/active', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, code, type, discount_value,
              min_order_value, max_discount_amount,
              applicable_to, applicable_ids,
              start_date, end_date
       FROM promotions
       WHERE is_active = 1
         AND start_date <= NOW()
         AND end_date   >= NOW()
         AND (usage_limit IS NULL OR usage_count < usage_limit)
       ORDER BY discount_value DESC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /promotions/validate/:code
 * Validate mã voucher cho checkout — trả về thông tin KM nếu hợp lệ
 */
router.get('/validate/:code', async (req, res) => {
  try {
    const code = req.params.code.trim().toUpperCase();
    if (!code) {
      return res.status(400).json({ success: false, message: 'Mã khuyến mãi không được để trống' });
    }

    const [rows] = await pool.query(
      `SELECT id, name, code, type, discount_value,
              min_order_value, max_discount_amount,
              applicable_to, applicable_ids, end_date
       FROM promotions
       WHERE code = ?
         AND is_active = 1
         AND start_date <= NOW()
         AND end_date   >= NOW()
         AND (usage_limit IS NULL OR usage_count < usage_limit)`,
      [code]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: 'Mã khuyến mãi không hợp lệ, đã hết hạn hoặc đã dùng đủ số lượt'
      });
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ──────────────────────────────────────────────
// ADMIN ROUTES
// ──────────────────────────────────────────────

/**
 * GET /promotions — Admin: tất cả KM với pagination
 * Query params: ?is_active=1|0, ?type=, ?page=, ?limit=
 */
router.get('/', canWrite, async (req, res) => {
  try {
    const { is_active, type, page = 1, limit = 20 } = req.query;
    const offset = (Math.max(1, Number(page)) - 1) * Math.min(50, Number(limit) || 20);
    const pageLimit = Math.min(50, Number(limit) || 20);

    const conditions = [];
    const params = [];

    if (is_active !== undefined) {
      conditions.push('is_active = ?');
      params.push(is_active === '1' || is_active === 'true' ? 1 : 0);
    }
    if (type && PROMO_TYPES.includes(type)) {
      conditions.push('type = ?');
      params.push(type);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM promotions ${where}`, params
    );

    const [rows] = await pool.query(
      `SELECT id, name, code, type, discount_value, min_order_value,
              max_discount_amount, applicable_to, usage_limit, usage_count,
              start_date, end_date, is_active, created_at
       FROM promotions ${where}
       ORDER BY created_at DESC
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
 * GET /promotions/:id — Admin: chi tiết KM
 */
router.get('/:id', canWrite, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.query('SELECT * FROM promotions WHERE id = ?', [id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy chương trình khuyến mãi' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /promotions — Tạo chương trình KM mới
 * Body: { name, type, discount_value, start_date, end_date,
 *          code?, min_order_value?, max_discount_amount?, applicable_to?,
 *          applicable_ids?, usage_limit? }
 */
router.post(
  '/',
  canWrite,
  requireFields(['name', 'type', 'discount_value', 'start_date', 'end_date']),
  validateEnum('type', PROMO_TYPES),
  validateEnum('applicable_to', APPLICABLE_TO),
  validateNumberRange('discount_value', { min: 0 }),
  validateNumberRange('min_order_value', { min: 0 }),
  validateDateWindow('start_date', 'end_date'),
  async (req, res) => {
    try {
      const {
        name,
        type,
        discount_value,
        start_date,
        end_date,
        code = null,
        min_order_value = 0,
        max_discount_amount = null,
        applicable_to = 'all',
        applicable_ids = null,
        usage_limit = null,
      } = req.body;

      // Validate: percent_discount không được > 100
      if (type === 'percent_discount' && Number(discount_value) > 100) {
        return res.status(400).json({ success: false, message: 'Phần trăm giảm giá không được vượt quá 100%' });
      }

      // applicable_ids bắt buộc khi applicable_to != 'all'
      if (applicable_to !== 'all' && (!applicable_ids || !Array.isArray(applicable_ids) || !applicable_ids.length)) {
        return res.status(400).json({
          success: false,
          message: 'applicable_ids là bắt buộc khi applicable_to là specific_categories hoặc specific_products'
        });
      }

      const [result] = await pool.query(
        `INSERT INTO promotions
           (name, code, type, discount_value, min_order_value, max_discount_amount,
            applicable_to, applicable_ids, usage_limit, start_date, end_date, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          name,
          code ? code.trim().toUpperCase() : null,
          type,
          Number(discount_value),
          Number(min_order_value) || 0,
          max_discount_amount ? Number(max_discount_amount) : null,
          applicable_to,
          applicable_ids ? JSON.stringify(applicable_ids) : null,
          usage_limit ? Number(usage_limit) : null,
          new Date(start_date),
          new Date(end_date),
        ]
      );

      res.status(201).json({ success: true, data: { id: result.insertId } });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ success: false, message: 'Mã voucher đã tồn tại, hãy dùng mã khác' });
      }
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PUT /promotions/:id — Cập nhật KM (partial update)
 * Lưu ý: usage_count KHÔNG được sửa trực tiếp (chỉ tăng qua order-service)
 */
router.put(
  '/:id',
  canWrite,
  validateEnum('type', PROMO_TYPES),
  validateEnum('applicable_to', APPLICABLE_TO),
  validateNumberRange('discount_value', { min: 0 }),
  validateNumberRange('min_order_value', { min: 0 }),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ success: false, message: 'id không hợp lệ' });
      }

      const [[existing]] = await pool.query('SELECT id FROM promotions WHERE id = ?', [id]);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy chương trình khuyến mãi' });
      }

      const {
        name, type, discount_value, code,
        min_order_value, max_discount_amount,
        applicable_to, applicable_ids,
        usage_limit, start_date, end_date, is_active
      } = req.body || {};

      const fields = [];
      const params = [];

      if (name !== undefined) { fields.push('name = ?'); params.push(name); }
      if (code !== undefined) { fields.push('code = ?'); params.push(code ? code.trim().toUpperCase() : null); }
      if (type !== undefined) { fields.push('type = ?'); params.push(type); }
      if (discount_value !== undefined) { fields.push('discount_value = ?'); params.push(Number(discount_value)); }
      if (min_order_value !== undefined) { fields.push('min_order_value = ?'); params.push(Number(min_order_value) || 0); }
      if (max_discount_amount !== undefined) { fields.push('max_discount_amount = ?'); params.push(max_discount_amount ? Number(max_discount_amount) : null); }
      if (applicable_to !== undefined) { fields.push('applicable_to = ?'); params.push(applicable_to); }
      if (applicable_ids !== undefined) { fields.push('applicable_ids = ?'); params.push(applicable_ids ? JSON.stringify(applicable_ids) : null); }
      if (usage_limit !== undefined) { fields.push('usage_limit = ?'); params.push(usage_limit ? Number(usage_limit) : null); }
      if (start_date !== undefined) { fields.push('start_date = ?'); params.push(new Date(start_date)); }
      if (end_date !== undefined) { fields.push('end_date = ?'); params.push(new Date(end_date)); }
      if (is_active !== undefined) { fields.push('is_active = ?'); params.push(is_active ? 1 : 0); }

      if (!fields.length) {
        return res.status(400).json({ success: false, message: 'Không có trường nào để cập nhật' });
      }

      await pool.query(`UPDATE promotions SET ${fields.join(', ')} WHERE id = ?`, [...params, id]);
      res.json({ success: true, message: 'Cập nhật chương trình khuyến mãi thành công' });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ success: false, message: 'Mã voucher đã tồn tại' });
      }
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * DELETE /promotions/:id — Soft delete KM
 */
router.delete('/:id', canWrite, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [result] = await pool.query(
      'UPDATE promotions SET is_active = 0 WHERE id = ? AND is_active = 1',
      [id]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy chương trình KM hoặc đã bị tắt' });
    }
    res.json({ success: true, message: 'Chương trình khuyến mãi đã tắt thành công' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
