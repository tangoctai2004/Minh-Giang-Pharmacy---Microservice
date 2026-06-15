/**
 * loyalty.routes.js — Quản lý cấu hình chương trình tích điểm thành viên
 *
 * Cross-database: đọc/ghi mg_identity.loyalty_tier_config
 *                 thống kê từ mg_identity.customers
 *
 * Admin:
 *   GET  /loyalty/tiers    — Cấu hình 4 hạng thành viên
 *   PUT  /loyalty/tiers    — Cập nhật batch tỷ lệ tích điểm
 *   GET  /loyalty/stats    — Phân bổ KH theo hạng + tổng điểm
 *   GET  /loyalty/config   — Cấu hình quy đổi điểm từ store_config
 *   PUT  /loyalty/config   — Lưu cấu hình quy đổi điểm
 */
const router = require('express').Router();
const pool = require('../db/pool');
const requireRoles = require('../middlewares/requireRoles');

const canWrite = requireRoles(['admin']);

// ────────────────────────────────────────────────────────────
// Mapping UI label → DB tier_code
// DB: member | silver | gold | vip
// UI: Đồng   | Bạc    | Vàng | Kim Cương
// ────────────────────────────────────────────────────────────
const TIER_META = {
  member: { label: 'Đồng',      emoji: '🥉', color: '#92400e' },
  silver: { label: 'Bạc',       emoji: '🥈', color: '#475569' },
  gold:   { label: 'Vàng',      emoji: '🥇', color: '#a16207' },
  vip:    { label: 'Kim Cương', emoji: '💎', color: '#1d4ed8' },
};

/**
 * GET /loyalty/tiers
 * Trả về cấu hình 4 hạng thành viên từ mg_identity.loyalty_tier_config
 */
router.get('/tiers', canWrite, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, tier_code, tier_name, tier_icon,
              min_spending, max_spending,
              points_ratio AS points_rate, points_per_vnd AS points_per_amount,
              discount_pct, description,
              points_expiry_months, updated_at
       FROM mg_identity.loyalty_tier_config
       ORDER BY min_spending ASC`
    );

    // Enrich với metadata UI
    const enriched = rows.map(r => ({
      ...r,
      meta: TIER_META[r.tier_code] || {},
    }));

    res.json({ success: true, data: enriched });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /loyalty/tiers
 * Cập nhật batch cấu hình tích điểm cho tất cả hạng
 * Body: { tiers: [{ tier_code, points_rate, discount_pct, min_spending, max_spending }] }
 */
router.put('/tiers', canWrite, async (req, res) => {
  const { tiers } = req.body;
  if (!Array.isArray(tiers) || !tiers.length) {
    return res.status(400).json({ success: false, message: 'Danh sách hạng không hợp lệ' });
  }

  const VALID_TIERS = ['member', 'silver', 'gold', 'vip'];
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    for (const tier of tiers) {
      const { tier_code, points_rate, discount_pct, min_spending, max_spending, points_expiry_months } = tier;

      if (!VALID_TIERS.includes(tier_code)) continue;

      const fields = [];
      const params = [];

      if (points_rate !== undefined)          { fields.push('points_ratio = ?');          params.push(Number(points_rate)); }
      if (discount_pct !== undefined)         { fields.push('discount_pct = ?');         params.push(Number(discount_pct)); }
      if (min_spending !== undefined)         { fields.push('min_spending = ?');          params.push(Number(min_spending)); }
      if (max_spending !== undefined)         { fields.push('max_spending = ?');          params.push(max_spending != null ? Number(max_spending) : null); }
      if (points_expiry_months !== undefined) { fields.push('points_expiry_months = ?'); params.push(Number(points_expiry_months)); }

      if (!fields.length) continue;

      await connection.query(
        `UPDATE mg_identity.loyalty_tier_config SET ${fields.join(', ')} WHERE tier_code = ?`,
        [...params, tier_code]
      );
    }

    await connection.commit();
    res.json({ success: true, message: 'Đã lưu cấu hình hạng thành viên thành công' });
  } catch (err) {
    if (connection) await connection.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    if (connection) connection.release();
  }
});

/**
 * GET /loyalty/stats
 * Phân bổ khách hàng theo hạng + tổng điểm đang lưu
 * Cross-db: mg_identity.customers
 */
router.get('/stats', canWrite, async (req, res) => {
  try {
    const [tierCounts] = await pool.query(
      `SELECT loyalty_tier,
              COUNT(*) AS customer_count,
              SUM(loyalty_points) AS total_points,
              AVG(loyalty_points) AS avg_points
       FROM mg_identity.customers
       WHERE deleted_at IS NULL AND is_active = 1
       GROUP BY loyalty_tier
       ORDER BY FIELD(loyalty_tier, 'member', 'silver', 'gold', 'vip')`
    );

    const [[totals]] = await pool.query(
      `SELECT COUNT(*) AS total_customers,
              COALESCE(SUM(loyalty_points), 0) AS total_points_system
       FROM mg_identity.customers
       WHERE deleted_at IS NULL AND is_active = 1`
    );

    // Enrich với metadata
    const breakdown = tierCounts.map(r => ({
      ...r,
      ...TIER_META[r.loyalty_tier],
      customer_count: Number(r.customer_count),
      total_points:   Number(r.total_points) || 0,
      avg_points:     Math.round(Number(r.avg_points) || 0),
      percentage:     totals.total_customers > 0
                      ? Math.round((Number(r.customer_count) / Number(totals.total_customers)) * 100)
                      : 0,
    }));

    res.json({
      success: true,
      data: {
        breakdown,
        total_customers:     Number(totals.total_customers),
        total_points_system: Number(totals.total_points_system),
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /loyalty/config
 * Cấu hình quy đổi điểm từ store_config (mg_cms.store_config)
 * Keys: loyalty_points_per_vnd, loyalty_min_redeem, loyalty_max_redeem_per_order,
 *       loyalty_allow_web, loyalty_allow_pos
 */
router.get('/config', canWrite, async (req, res) => {
  try {
    const LOYALTY_KEYS = [
      'loyalty_points_per_vnd',
      'loyalty_min_redeem',
      'loyalty_max_redeem_per_order',
      'loyalty_allow_web',
      'loyalty_allow_pos',
    ];

    const [rows] = await pool.query(
      `SELECT config_key, config_value, value_type, display_name, description
       FROM store_config
       WHERE config_key IN (${LOYALTY_KEYS.map(() => '?').join(',')})
         AND is_active = 1`,
      LOYALTY_KEYS
    );

    // Parse values theo value_type
    const config = {};
    for (const row of rows) {
      let val = row.config_value;
      if (row.value_type === 'integer') val = parseInt(val, 10);
      else if (row.value_type === 'decimal') val = parseFloat(val);
      else if (row.value_type === 'boolean') val = val === 'true' || val === '1';
      config[row.config_key] = { value: val, display_name: row.display_name, description: row.description };
    }

    // Fallback defaults nếu chưa có trong DB
    const defaults = {
      loyalty_points_per_vnd:         { value: 100,    display_name: 'Tỷ lệ quy đổi điểm (điểm → VNĐ)', description: '100 điểm = 1,000₫' },
      loyalty_min_redeem:             { value: 500,    display_name: 'Số điểm tối thiểu để quy đổi', description: 'Khách cần ≥ 500 điểm mới được đổi' },
      loyalty_max_redeem_per_order:   { value: 200000, display_name: 'Giá trị quy đổi tối đa / đơn hàng', description: 'Tối đa 200,000₫ từ điểm / đơn' },
      loyalty_allow_web:              { value: true,   display_name: 'Cho phép quy đổi trên Website', description: '' },
      loyalty_allow_pos:              { value: true,   display_name: 'Cho phép quy đổi tại POS Kiosk', description: '' },
    };

    const result = {};
    for (const key of LOYALTY_KEYS) {
      result[key] = config[key] || defaults[key];
    }

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /loyalty/config
 * Lưu cấu hình quy đổi điểm vào store_config
 * Body: { loyalty_points_per_vnd, loyalty_min_redeem, loyalty_max_redeem_per_order,
 *          loyalty_allow_web, loyalty_allow_pos }
 */
router.put('/config', canWrite, async (req, res) => {
  const ALLOWED = {
    loyalty_points_per_vnd:       { type: 'integer', display: 'Tỷ lệ quy đổi điểm' },
    loyalty_min_redeem:           { type: 'integer', display: 'Điểm tối thiểu quy đổi' },
    loyalty_max_redeem_per_order: { type: 'integer', display: 'Giá trị quy đổi tối đa/đơn' },
    loyalty_allow_web:            { type: 'boolean', display: 'Quy đổi trên Website' },
    loyalty_allow_pos:            { type: 'boolean', display: 'Quy đổi tại POS Kiosk' },
  };

  const userId = req.headers['x-user-id'] || null;
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    for (const [key, meta] of Object.entries(ALLOWED)) {
      if (req.body[key] === undefined) continue;

      const rawVal = req.body[key];
      let strVal;
      if (meta.type === 'boolean') strVal = rawVal ? 'true' : 'false';
      else strVal = String(rawVal);

      await connection.query(
        `INSERT INTO store_config (config_key, config_value, value_type, display_name, group_name, is_public, updated_by)
         VALUES (?, ?, ?, ?, 'loyalty', 0, ?)
         ON DUPLICATE KEY UPDATE config_value = VALUES(config_value), updated_by = VALUES(updated_by)`,
        [key, strVal, meta.type, meta.display, userId]
      );
    }

    await connection.commit();
    res.json({ success: true, message: 'Đã lưu cấu hình tích điểm thành công' });
  } catch (err) {
    if (connection) await connection.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;
