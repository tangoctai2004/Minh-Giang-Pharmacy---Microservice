/**
 * store-config.routes.js — Quản lý cấu hình nhà thuốc (key-value store)
 *
 * Bảo mật:
 *   - config có is_sensitive=1 (API key, password) KHÔNG BAO GIỜ trả về qua /public
 *   - Admin nhìn thấy tất cả nhưng value sensitive hiển thị là '***HIDDEN***'
 *
 * Public:
 *   GET  /store-config/public    — Config an toàn để hiển thị trên website
 *
 * Admin:
 *   GET  /store-config           — Tất cả config (sensitive ẩn value)
 *   POST /store-config           — Tạo config key mới
 *   PUT  /store-config/:key      — Cập nhật config value
 *   DELETE /store-config/:key    — Soft delete (is_active = 0)
 */
const router = require('express').Router();
const pool = require('../db/pool');
const requireRoles = require('../middlewares/requireRoles');
const { requireFields, validateEnum } = require('../middlewares/validate');

const VALUE_TYPES = ['string', 'integer', 'decimal', 'boolean', 'json'];
const canWrite = requireRoles(['admin']);

// ──────────────────────────────────────────────
// PUBLIC
// ──────────────────────────────────────────────

/**
 * GET /store-config/public
 * Chỉ trả về config: is_active=1 VÀ is_sensitive=0
 * Kết quả là object key-value phẳng: { store_name: "Nhà thuốc Minh Giang", ... }
 */
router.get('/public', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT config_key, config_value, value_type
       FROM store_config
       WHERE is_active = 1 AND (is_sensitive = 0 OR is_sensitive IS NULL)
       ORDER BY config_key`
    );

    // Parse value theo value_type
    const config = {};
    rows.forEach(r => {
      try {
        if (r.value_type === 'integer') config[r.config_key] = parseInt(r.config_value, 10);
        else if (r.value_type === 'decimal') config[r.config_key] = parseFloat(r.config_value);
        else if (r.value_type === 'boolean') config[r.config_key] = r.config_value === 'true' || r.config_value === '1';
        else if (r.value_type === 'json') config[r.config_key] = JSON.parse(r.config_value);
        else config[r.config_key] = r.config_value;
      } catch {
        config[r.config_key] = r.config_value; // fallback nếu parse lỗi
      }
    });

    res.json({ success: true, data: config });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ──────────────────────────────────────────────
// ADMIN ROUTES
// ──────────────────────────────────────────────

/**
 * GET /store-config — Admin: tất cả config (sensitive ẩn giá trị)
 * Query params: ?group_name= — lọc theo nhóm (store, payment, shipping, loyalty, notification)
 */
router.get('/', canWrite, async (req, res) => {
  try {
    const { group_name } = req.query;
    const conditions = [];
    const params = [];

    if (group_name) {
      conditions.push('group_name = ?');
      params.push(group_name);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `SELECT id, config_key, display_name, description, group_name,
              value_type, is_sensitive, is_public, is_editable, is_active,
              CASE WHEN is_sensitive = 1 THEN '***HIDDEN***' ELSE config_value END AS config_value,
              updated_by, updated_at
       FROM store_config
       ${where}
       ORDER BY group_name, config_key`,
      params
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /store-config — Tạo config key mới
 * Body: { config_key, config_value, value_type, display_name,
 *          description?, group_name?, is_public?, is_sensitive?, is_editable? }
 */
router.post(
  '/',
  canWrite,
  requireFields(['config_key', 'config_value', 'display_name', 'value_type']),
  validateEnum('value_type', VALUE_TYPES),
  async (req, res) => {
    try {
      const {
        config_key,
        config_value,
        value_type,
        display_name,
        description = null,
        group_name = 'general',
        is_public = 0,
        is_sensitive = 0,
        is_editable = 1,
      } = req.body;

      // Validate config_key format: snake_case
      if (!/^[a-z0-9_]+$/.test(config_key)) {
        return res.status(400).json({
          success: false,
          message: 'config_key chỉ được dùng chữ thường, số và dấu gạch dưới (snake_case)'
        });
      }

      await pool.query(
        `INSERT INTO store_config
           (config_key, config_value, value_type, display_name, description,
            group_name, is_public, is_sensitive, is_editable, updated_by, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          config_key,
          String(config_value),
          value_type,
          display_name,
          description,
          group_name,
          is_public ? 1 : 0,
          is_sensitive ? 1 : 0,
          is_editable ? 1 : 0,
          req.userId || null,
        ]
      );

      res.status(201).json({ success: true, data: { config_key } });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ success: false, message: 'config_key đã tồn tại' });
      }
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PUT /store-config/:key — Cập nhật config value
 * Body: { config_value, display_name?, description?, is_active?, is_public? }
 * Không cho phép đổi config_key (PK)
 */
router.put('/:key', canWrite, async (req, res) => {
  try {
    const { key } = req.params;

    const [[existing]] = await pool.query(
      'SELECT config_key, is_editable, is_sensitive FROM store_config WHERE config_key = ?',
      [key]
    );
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy config key' });
    }
    if (!existing.is_editable) {
      return res.status(403).json({ success: false, message: 'Config này ở chế độ chỉ đọc, không thể sửa' });
    }

    const { config_value, display_name, description, is_active, is_public } = req.body || {};
    const fields = [];
    const params = [];

    if (config_value !== undefined) { fields.push('config_value = ?'); params.push(String(config_value)); }
    if (display_name !== undefined) { fields.push('display_name = ?'); params.push(display_name); }
    if (description !== undefined) { fields.push('description = ?'); params.push(description || null); }
    if (is_active !== undefined) { fields.push('is_active = ?'); params.push(is_active ? 1 : 0); }
    if (is_public !== undefined) {
      // Config sensitive không được set is_public = 1
      if (existing.is_sensitive && is_public) {
        return res.status(400).json({ success: false, message: 'Config nhạy cảm không được đặt là public' });
      }
      fields.push('is_public = ?'); params.push(is_public ? 1 : 0);
    }

    fields.push('updated_by = ?'); params.push(req.userId || null);

    if (fields.length <= 1) { // chỉ có updated_by
      return res.status(400).json({ success: false, message: 'Không có trường nào để cập nhật' });
    }

    await pool.query(
      `UPDATE store_config SET ${fields.join(', ')} WHERE config_key = ?`,
      [...params, key]
    );
    res.json({ success: true, message: `Cập nhật ${key} thành công` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * DELETE /store-config/:key — Soft delete config
 */
router.delete('/:key', canWrite, async (req, res) => {
  try {
    const { key } = req.params;
    const [result] = await pool.query(
      'UPDATE store_config SET is_active = 0 WHERE config_key = ? AND is_active = 1',
      [key]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy config hoặc đã bị vô hiệu' });
    }
    res.json({ success: true, message: `Config ${key} đã bị vô hiệu hoá` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
