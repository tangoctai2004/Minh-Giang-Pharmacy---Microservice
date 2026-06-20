/**
 * promotions.routes.js — Quản lý chương trình khuyến mãi & voucher
 *
 * Database: mg_cms.promotions
 * Columns: id, name, campaign_name, code, type, discount_value,
 *          min_order_value, max_discount_amount, applicable_to, applicable_ids,
 *          usage_limit, usage_count, start_date, end_date, is_active, created_at,
 *          gift_product_name, gift_product_qty, applicable_channel
 *
 * Enum type: 'percent_discount' | 'fixed_discount' | 'free_shipping' | 'buy_x_get_y'
 *
 * Public:
 *   GET  /promotions/active          — KM đang chạy (không cần mã)
 *   GET  /promotions/validate/:code  — Validate mã voucher khi checkout
 *
 * Admin:
 *   GET  /promotions/stats           — Dashboard statistics
 *   GET  /promotions/export          — Xuất CSV
 *   GET  /promotions               — Tất cả KM (có pagination + filter)
 *   GET  /promotions/:id           — Chi tiết KM
 *   POST /promotions               — Tạo KM mới
 *   PUT  /promotions/:id           — Cập nhật KM
 *   PUT  /promotions/:id/toggle    — Bật/tắt KM
 *   POST /promotions/:id/clone     — Nhân bản KM
 *   DELETE /promotions/:id         — Soft delete (is_active = 0)
 */
const router = require('express').Router();
const pool = require('../db/pool');
const requireRoles = require('../middlewares/requireRoles');
const { requireFields, validateEnum, validateNumberRange, validateDateWindow } = require('../middlewares/validate');

const PROMO_TYPES = ['percent_discount', 'fixed_discount', 'free_shipping', 'buy_x_get_y'];
const APPLICABLE_TO = ['all', 'specific_categories', 'specific_products'];
const APPLICABLE_CHANNELS = ['all', 'web', 'pos'];
const canWrite = requireRoles(['admin']);

// ──────────────────────────────────────────────
// PUBLIC ROUTES (không cần auth)
// ──────────────────────────────────────────────

/**
 * GET /promotions/active
 * Trả về tất cả KM đang chạy tự động (không cần nhập mã)
 * Dùng cho checkout web/POS để tự động apply
 */
router.get('/active', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, campaign_name, code, type, discount_value,
              min_order_value, max_discount_amount,
              applicable_to, applicable_ids, applicable_channel,
              gift_product_name, gift_product_qty,
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
 * Dùng bởi web checkout và POS kiosk
 */
router.get('/validate/:code', async (req, res) => {
  try {
    const code = req.params.code.trim().toUpperCase();
    if (!code) {
      return res.status(400).json({ success: false, message: 'Mã khuyến mãi không được để trống' });
    }

    const [rows] = await pool.query(
      `SELECT id, name, campaign_name, code, type, discount_value,
              min_order_value, max_discount_amount,
              applicable_to, applicable_ids, applicable_channel,
              end_date, usage_limit, usage_count
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
 * GET /promotions/stats
 * Thống kê dashboard: active vouchers, monthly usages, gift campaigns, expiring soon
 */
router.get('/stats', canWrite, async (req, res) => {
  try {
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const [[stats]] = await pool.query(
      `SELECT
        SUM(CASE WHEN is_active = 1 AND start_date <= NOW() AND end_date >= NOW()
                  AND type != 'buy_x_get_y' THEN 1 ELSE 0 END) AS active_vouchers,

        SUM(CASE WHEN is_active = 1 AND start_date <= NOW() AND end_date >= NOW()
                  AND type = 'buy_x_get_y' THEN 1 ELSE 0 END)  AS active_gift_campaigns,

        SUM(CASE WHEN is_active = 1 AND start_date <= NOW() AND end_date >= NOW()
                  AND type = 'buy_x_get_y' THEN usage_count ELSE 0 END) AS gift_given_total,

        SUM(CASE WHEN end_date >= NOW() AND end_date <= ?
                  AND is_active = 1 THEN 1 ELSE 0 END)           AS expiring_soon,

        COALESCE(SUM(
          CASE WHEN start_date >= ? THEN usage_count ELSE 0 END
        ), 0) AS monthly_usages,

        COUNT(*) AS total_promotions
       FROM promotions`,
      [in7Days, firstOfMonth]
    );

    // Tăng trưởng so tháng trước (so sánh usage_count của tháng hiện tại)
    const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
    const [[lastMonthStats]] = await pool.query(
      `SELECT COALESCE(SUM(
          CASE WHEN start_date >= ? AND start_date < ? THEN usage_count ELSE 0 END
        ), 0) AS last_month_usages
       FROM promotions`,
      [firstOfLastMonth, firstOfMonth]
    );

    const current = Number(stats.monthly_usages) || 0;
    const last = Number(lastMonthStats.last_month_usages) || 0;
    const growth = last > 0 ? Math.round(((current - last) / last) * 100) : null;

    res.json({
      success: true,
      data: {
        active_vouchers:      Number(stats.active_vouchers) || 0,
        active_gift_campaigns:Number(stats.active_gift_campaigns) || 0,
        gift_given_total:     Number(stats.gift_given_total) || 0,
        expiring_soon:        Number(stats.expiring_soon) || 0,
        monthly_usages:       current,
        monthly_growth_pct:   growth,
        total_promotions:     Number(stats.total_promotions) || 0,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /promotions/export
 * Xuất danh sách KM ra CSV (Admin only)
 */
router.get('/export', canWrite, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, COALESCE(code,'—') AS code, name, campaign_name,
              type, discount_value, min_order_value, max_discount_amount,
              usage_count, usage_limit, start_date, end_date,
              IF(is_active=1,'Active','Paused') AS status
       FROM promotions
       ORDER BY created_at DESC`
    );

    const headers = ['ID','Mã Voucher','Tên KM','Tên Chiến Dịch','Loại','Giá Trị Giảm',
                     'Đơn Tối Thiểu','Giảm Tối Đa','Đã Dùng','Giới Hạn',
                     'Bắt Đầu','Hết Hạn','Trạng Thái'];
    const csvRows = [headers.join(',')];

    for (const r of rows) {
      csvRows.push([
        r.id, r.code, `"${r.name}"`, `"${r.campaign_name || ''}"`,
        r.type, r.discount_value, r.min_order_value, r.max_discount_amount || '',
        r.usage_count, r.usage_limit || 'Không giới hạn',
        r.start_date?.toISOString().slice(0,10),
        r.end_date?.toISOString().slice(0,10),
        r.status
      ].join(','));
    }

    const bom = '\uFEFF';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="promotions_${Date.now()}.csv"`);
    res.send(bom + csvRows.join('\n'));
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /promotions — Admin: tất cả KM với pagination & filter
 * Query params: ?type= ?status=active|paused|expired ?code= ?page= ?limit=
 */
router.get('/', canWrite, async (req, res) => {
  try {
    const { type, exclude_type, status, code, search, page = 1, limit = 20 } = req.query;
    const offset = (Math.max(1, Number(page)) - 1) * Math.min(50, Number(limit) || 20);
    const pageLimit = Math.min(50, Number(limit) || 20);

    const conditions = [];
    const params = [];

    if (type && PROMO_TYPES.includes(type)) {
      conditions.push('type = ?');
      params.push(type);
    }

    if (exclude_type && PROMO_TYPES.includes(exclude_type)) {
      conditions.push('type != ?');
      params.push(exclude_type);
    }

    // Computed status filter
    if (status === 'active') {
      conditions.push('is_active = 1 AND start_date <= NOW() AND end_date >= NOW() AND (usage_limit IS NULL OR usage_count < usage_limit)');
    } else if (status === 'paused') {
      conditions.push('is_active = 0 AND end_date >= NOW()');
    } else if (status === 'expired') {
      conditions.push('end_date < NOW()');
    } else if (status === 'exhausted') {
      conditions.push('usage_limit IS NOT NULL AND usage_count >= usage_limit AND end_date >= NOW()');
    }

    if (code) {
      conditions.push('code LIKE ?');
      params.push(`%${code.toUpperCase()}%`);
    }

    if (search) {
      conditions.push('(code LIKE ? OR name LIKE ? OR campaign_name LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM promotions ${where}`, params
    );

    const [rows] = await pool.query(
      `SELECT id, name, campaign_name, code, type,
              discount_value, min_order_value, max_discount_amount,
              applicable_to, applicable_channel,
              usage_limit, usage_count,
              start_date, end_date, is_active, created_at,
              gift_product_name, gift_product_qty,
              -- Computed status
              CASE
                WHEN end_date < NOW() THEN 'expired'
                WHEN is_active = 0 THEN 'paused'
                WHEN usage_limit IS NOT NULL AND usage_count >= usage_limit THEN 'exhausted'
                WHEN start_date > NOW() THEN 'scheduled'
                ELSE 'active'
              END AS computed_status,
              -- Days remaining
              DATEDIFF(end_date, NOW()) AS days_remaining
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
    const [rows] = await pool.query(
      `SELECT *,
        CASE
          WHEN end_date < NOW() THEN 'expired'
          WHEN is_active = 0 THEN 'paused'
          WHEN usage_limit IS NOT NULL AND usage_count >= usage_limit THEN 'exhausted'
          WHEN start_date > NOW() THEN 'scheduled'
          ELSE 'active'
        END AS computed_status,
        DATEDIFF(end_date, NOW()) AS days_remaining
       FROM promotions WHERE id = ?`, [id]);
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
 *          code?, campaign_name?, min_order_value?, max_discount_amount?,
 *          applicable_to?, applicable_ids?, applicable_channel?,
 *          usage_limit?, gift_product_name?, gift_product_qty? }
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
        campaign_name = null,
        type,
        discount_value,
        start_date,
        end_date,
        code = null,
        min_order_value = 0,
        max_discount_amount = null,
        applicable_to = 'all',
        applicable_ids = null,
        applicable_channel = 'all',
        usage_limit = null,
        gift_product_name = null,
        gift_product_qty = 1,
        is_active = 1,
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

      // buy_x_get_y: discount_value = 0, gift_product_name bắt buộc
      if (type === 'buy_x_get_y' && !gift_product_name) {
        return res.status(400).json({ success: false, message: 'gift_product_name là bắt buộc cho chiến dịch quà tặng' });
      }

      const [result] = await pool.query(
        `INSERT INTO promotions
           (name, campaign_name, code, type, discount_value, min_order_value, max_discount_amount,
            applicable_to, applicable_ids, applicable_channel,
            usage_limit, start_date, end_date, is_active,
            gift_product_name, gift_product_qty)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          name,
          campaign_name,
          code ? code.trim().toUpperCase() : null,
          type,
          Number(discount_value),
          Number(min_order_value) || 0,
          max_discount_amount ? Number(max_discount_amount) : null,
          applicable_to,
          applicable_ids ? JSON.stringify(applicable_ids) : null,
          applicable_channel || 'all',
          usage_limit ? Number(usage_limit) : null,
          new Date(start_date),
          new Date(end_date),
          is_active !== undefined ? Number(is_active) : 1,
          gift_product_name || null,
          Number(gift_product_qty) || 1,
        ]
      );

      res.status(201).json({ success: true, data: { id: result.insertId }, message: 'Tạo chương trình khuyến mãi thành công' });
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
        name, campaign_name, type, discount_value, code,
        min_order_value, max_discount_amount,
        applicable_to, applicable_ids, applicable_channel,
        usage_limit, start_date, end_date, is_active,
        gift_product_name, gift_product_qty
      } = req.body || {};

      const fields = [];
      const params = [];

      if (name !== undefined)              { fields.push('name = ?');               params.push(name); }
      if (campaign_name !== undefined)     { fields.push('campaign_name = ?');      params.push(campaign_name); }
      if (code !== undefined)              { fields.push('code = ?');               params.push(code ? code.trim().toUpperCase() : null); }
      if (type !== undefined)              { fields.push('type = ?');               params.push(type); }
      if (discount_value !== undefined)    { fields.push('discount_value = ?');     params.push(Number(discount_value)); }
      if (min_order_value !== undefined)   { fields.push('min_order_value = ?');    params.push(Number(min_order_value) || 0); }
      if (max_discount_amount !== undefined){ fields.push('max_discount_amount = ?'); params.push(max_discount_amount ? Number(max_discount_amount) : null); }
      if (applicable_to !== undefined)     { fields.push('applicable_to = ?');      params.push(applicable_to); }
      if (applicable_ids !== undefined)    { fields.push('applicable_ids = ?');     params.push(applicable_ids ? JSON.stringify(applicable_ids) : null); }
      if (applicable_channel !== undefined){ fields.push('applicable_channel = ?'); params.push(applicable_channel); }
      if (usage_limit !== undefined)       { fields.push('usage_limit = ?');        params.push(usage_limit ? Number(usage_limit) : null); }
      if (start_date !== undefined)        { fields.push('start_date = ?');         params.push(new Date(start_date)); }
      if (end_date !== undefined)          { fields.push('end_date = ?');           params.push(new Date(end_date)); }
      if (is_active !== undefined)         { fields.push('is_active = ?');          params.push(is_active ? 1 : 0); }
      if (gift_product_name !== undefined) { fields.push('gift_product_name = ?'); params.push(gift_product_name || null); }
      if (gift_product_qty !== undefined)  { fields.push('gift_product_qty = ?');  params.push(Number(gift_product_qty) || 1); }

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
 * PUT /promotions/:id/toggle
 * Bật/tắt trạng thái KM (flip is_active)
 */
router.put('/:id/toggle', canWrite, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [[row]] = await pool.query('SELECT id, is_active, name FROM promotions WHERE id = ?', [id]);
    if (!row) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy chương trình KM' });
    }

    const newState = row.is_active ? 0 : 1;
    await pool.query('UPDATE promotions SET is_active = ? WHERE id = ?', [newState, id]);

    res.json({
      success: true,
      data: { id, is_active: newState },
      message: newState ? `Đã kích hoạt "${row.name}"` : `Đã tạm dừng "${row.name}"`
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /promotions/:id/clone
 * Nhân bản KM — tạo bản copy với code mới (nếu có) và reset usage_count
 */
router.post('/:id/clone', canWrite, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [[src]] = await pool.query('SELECT * FROM promotions WHERE id = ?', [id]);
    if (!src) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy chương trình KM để nhân bản' });
    }

    // Tạo code mới nếu nguồn có code (thêm _COPY suffix)
    let newCode = null;
    if (src.code) {
      const base = src.code.replace(/_COPY\d*$/, '');
      // Đảm bảo unique
      const [[existing]] = await pool.query(
        "SELECT COUNT(*) AS cnt FROM promotions WHERE code LIKE ?",
        [`${base}_COPY%`]
      );
      newCode = `${base}_COPY${existing.cnt > 0 ? existing.cnt : ''}`;
    }

    const [result] = await pool.query(
      `INSERT INTO promotions
         (name, campaign_name, code, type, discount_value, min_order_value, max_discount_amount,
          applicable_to, applicable_ids, applicable_channel,
          usage_limit, usage_count, start_date, end_date, is_active,
          gift_product_name, gift_product_qty)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 0, ?, ?)`,
      [
        `[Bản sao] ${src.name}`,
        src.campaign_name,
        newCode,
        src.type,
        src.discount_value,
        src.min_order_value,
        src.max_discount_amount,
        src.applicable_to,
        src.applicable_ids ? JSON.stringify(src.applicable_ids) : null,
        src.applicable_channel || 'all',
        src.usage_limit,
        src.start_date,
        src.end_date,
        src.gift_product_name,
        src.gift_product_qty || 1,
      ]
    );

    res.status(201).json({
      success: true,
      data: { id: result.insertId, code: newCode },
      message: 'Nhân bản thành công — vui lòng kiểm tra và kích hoạt trước khi dùng'
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Mã voucher copy đã tồn tại' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * DELETE /promotions/:id — Soft delete KM (set is_active = 0)
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

// POST /promotions/usage/increment — Tăng lượt sử dụng voucher/khuyến mãi (Internal)
router.post('/usage/increment', async (req, res) => {
  const isInternalService = Boolean(
    req.headers['x-internal-token'] === process.env.INTERNAL_SERVICE_TOKEN
  );
  if (!isInternalService && process.env.NODE_ENV === 'production') {
    return res.status(403).json({ success: false, message: 'Chỉ chấp nhận cuộc gọi nội bộ.' });
  }

  const { promotion_ids = [] } = req.body || {};
  if (!Array.isArray(promotion_ids) || promotion_ids.length === 0) {
    return res.status(400).json({ success: false, message: 'Thiếu promotion_ids' });
  }

  const ids = promotion_ids.map(Number).filter(id => !Number.isNaN(id));
  if (ids.length === 0) {
    return res.status(400).json({ success: false, message: 'Danh sách ID không hợp lệ' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.query('START TRANSACTION');

    // Sử dụng FOR UPDATE để tránh race conditions (Lỗi 17)
    const [promos] = await conn.query(
      `SELECT id, usage_limit, usage_count 
       FROM promotions 
       WHERE id IN (?) 
       FOR UPDATE`,
      [ids]
    );

    for (const promo of promos) {
      if (promo.usage_limit !== null && promo.usage_count >= promo.usage_limit) {
        await conn.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          message: `Chương trình khuyến mãi #${promo.id} đã hết lượt sử dụng`
        });
      }
    }

    await conn.query(
      `UPDATE promotions 
       SET usage_count = usage_count + 1 
       WHERE id IN (?)`,
      [ids]
    );

    await conn.query('COMMIT');
    res.json({ success: true, message: 'Đã tăng lượt sử dụng voucher thành công' });
  } catch (err) {
    await conn.query('ROLLBACK');
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

// POST /promotions/usage/decrement — Giảm/hoàn lượt sử dụng voucher/khuyến mãi (Internal)
router.post('/usage/decrement', async (req, res) => {
  const isInternalService = Boolean(
    req.headers['x-internal-token'] === process.env.INTERNAL_SERVICE_TOKEN
  );
  if (!isInternalService && process.env.NODE_ENV === 'production') {
    return res.status(403).json({ success: false, message: 'Chỉ chấp nhận cuộc gọi nội bộ.' });
  }

  const { promotion_ids = [] } = req.body || {};
  if (!Array.isArray(promotion_ids) || promotion_ids.length === 0) {
    return res.status(400).json({ success: false, message: 'Thiếu promotion_ids' });
  }

  const ids = promotion_ids.map(Number).filter(id => !Number.isNaN(id));
  if (ids.length === 0) {
    return res.status(400).json({ success: false, message: 'Danh sách ID không hợp lệ' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.query('START TRANSACTION');

    await conn.query(
      `UPDATE promotions 
       SET usage_count = GREATEST(0, CAST(usage_count AS SIGNED) - 1) 
       WHERE id IN (?)`,
      [ids]
    );

    await conn.query('COMMIT');
    res.json({ success: true, message: 'Đã hoàn trả lượt sử dụng voucher thành công' });
  } catch (err) {
    await conn.query('ROLLBACK');
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

module.exports = router;

