const router = require('express').Router();
const pool = require('../db/pool');
const requireRoles = require('../middlewares/requireRoles');
const { requireFields, validateEnum, validateNumberRange, validateDateWindow } = require('../middlewares/validate');
const { writeAudit } = require('../services/audit.service');

const canManagePromotions = requireRoles(['admin', 'manager']);

async function syncVoucherStatuses() {
  await pool.query(
    `UPDATE catalog_vouchers
     SET status = 'expired'
     WHERE status IN ('active', 'paused')
       AND valid_to IS NOT NULL
       AND valid_to < CURDATE()`
  );
  await pool.query(
    `UPDATE catalog_vouchers
     SET status = 'used_up'
     WHERE usage_limit > 0
       AND usage_count >= usage_limit`
  );
}

router.get('/stats', canManagePromotions, async (req, res) => {
  try {
    await syncVoucherStatuses();
    const [[voucherStats]] = await pool.query(
      `SELECT
         SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_vouchers,
         COALESCE(SUM(usage_count), 0) AS total_usage_month,
         SUM(CASE WHEN status = 'active' AND valid_to BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS expiring_soon
       FROM catalog_vouchers`
    );
    const [[giftStats]] = await pool.query(
      `SELECT SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS gift_campaigns
       FROM catalog_gift_campaigns`
    );

    res.json({
      success: true,
      data: {
        active_vouchers: Number(voucherStats.active_vouchers || 0),
        total_usage_month: Number(voucherStats.total_usage_month || 0),
        gift_campaigns: Number(giftStats.gift_campaigns || 0),
        expiring_soon: Number(voucherStats.expiring_soon || 0)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/vouchers', canManagePromotions, async (req, res) => {
  try {
    await syncVoucherStatuses();
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const q = req.query.q ? `%${req.query.q}%` : null;
    const type = req.query.type || null;
    const status = req.query.status || null;

    let where = 'WHERE 1=1';
    const params = [];
    if (q) { where += ' AND (code LIKE ? OR name LIKE ?)'; params.push(q, q); }
    if (type) { where += ' AND discount_type = ?'; params.push(type); }
    if (status) { where += ' AND status = ?'; params.push(status); }

    const [data] = await pool.query(
      `SELECT * FROM catalog_vouchers ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM catalog_vouchers ${where}`,
      params
    );
    const totalPages = Math.ceil(total / limit);
    res.json({ success: true, data, pagination: { total, page, limit, pages: totalPages, total_pages: totalPages } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post(
  '/vouchers',
  canManagePromotions,
  requireFields(['code', 'name', 'discount_type', 'discount_value']),
  validateEnum('discount_type', ['percent', 'fixed', 'freeship']),
  validateEnum('status', ['active', 'paused', 'expired', 'used_up']),
  validateNumberRange('discount_value', { min: 0 }),
  validateNumberRange('min_order_amount', { min: 0 }),
  validateNumberRange('usage_limit', { min: 0 }),
  validateDateWindow('valid_from', 'valid_to'),
  async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.code || !body.name || !body.discount_type || body.discount_value === undefined) {
      return res.status(400).json({ success: false, message: 'Thiếu trường bắt buộc để tạo voucher' });
    }
    const [result] = await pool.query(
      `INSERT INTO catalog_vouchers
      (code, name, discount_type, discount_value, max_discount, min_order_amount, usage_limit, valid_from, valid_to, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(body.code).toUpperCase(), body.name, body.discount_type, Number(body.discount_value),
        body.max_discount ?? null, Number(body.min_order_amount || 0), Number(body.usage_limit || 0),
        body.valid_from || null, body.valid_to || null, body.status || 'active'
      ]
    );
    const [[voucher]] = await pool.query(`SELECT * FROM catalog_vouchers WHERE id = ?`, [result.insertId]);
    await writeAudit({
      action: 'voucher_create',
      entity_type: 'catalog_voucher',
      entity_id: voucher.id,
      user_id: req.userId,
      request_id: req.requestId,
      after_data: voucher,
    });
    res.status(201).json({ success: true, data: voucher });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Mã voucher đã tồn tại' });
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put(
  '/vouchers/:id',
  canManagePromotions,
  validateEnum('discount_type', ['percent', 'fixed', 'freeship']),
  validateEnum('status', ['active', 'paused', 'expired', 'used_up']),
  validateNumberRange('discount_value', { min: 0 }),
  validateNumberRange('min_order_amount', { min: 0 }),
  validateNumberRange('usage_limit', { min: 0 }),
  validateDateWindow('valid_from', 'valid_to'),
  async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [[existing]] = await pool.query(`SELECT id FROM catalog_vouchers WHERE id = ?`, [id]);
    if (!existing) return res.status(404).json({ success: false, message: 'Không tìm thấy voucher' });

    const body = req.body || {};
    const fields = [];
    const params = [];
    ['name', 'discount_type', 'discount_value', 'max_discount', 'min_order_amount', 'usage_limit', 'valid_from', 'valid_to', 'status'].forEach((key) => {
      if (body[key] !== undefined) { fields.push(`${key} = ?`); params.push(body[key]); }
    });
    if (!fields.length) return res.status(400).json({ success: false, message: 'Không có trường để cập nhật' });
    const [[beforeRow]] = await pool.query(`SELECT * FROM catalog_vouchers WHERE id = ?`, [id]);
    await pool.query(`UPDATE catalog_vouchers SET ${fields.join(', ')} WHERE id = ?`, [...params, id]);
    const [[voucher]] = await pool.query(`SELECT * FROM catalog_vouchers WHERE id = ?`, [id]);
    await writeAudit({
      action: 'voucher_update',
      entity_type: 'catalog_voucher',
      entity_id: voucher.id,
      user_id: req.userId,
      request_id: req.requestId,
      before_data: beforeRow,
      after_data: voucher,
    });
    res.json({ success: true, data: voucher });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/vouchers/:id/toggle', canManagePromotions, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const status = req.body?.status;
    if (!['active', 'paused'].includes(status)) {
      return res.status(400).json({ success: false, message: 'status phải là active hoặc paused' });
    }
    const [[beforeRow]] = await pool.query(`SELECT * FROM catalog_vouchers WHERE id = ?`, [id]);
    const [result] = await pool.query(`UPDATE catalog_vouchers SET status = ? WHERE id = ?`, [status, id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Không tìm thấy voucher' });
    const [[voucher]] = await pool.query(`SELECT * FROM catalog_vouchers WHERE id = ?`, [id]);
    await writeAudit({
      action: 'voucher_toggle',
      entity_type: 'catalog_voucher',
      entity_id: voucher.id,
      user_id: req.userId,
      request_id: req.requestId,
      before_data: beforeRow,
      after_data: voucher,
    });
    res.json({ success: true, data: voucher });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/vouchers/:id/reset-usage', canManagePromotions, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [[beforeRow]] = await pool.query(`SELECT * FROM catalog_vouchers WHERE id = ?`, [id]);
    const [result] = await pool.query(`UPDATE catalog_vouchers SET usage_count = 0 WHERE id = ?`, [id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Không tìm thấy voucher' });
    const [[voucher]] = await pool.query(`SELECT * FROM catalog_vouchers WHERE id = ?`, [id]);
    await writeAudit({
      action: 'voucher_reset_usage',
      entity_type: 'catalog_voucher',
      entity_id: voucher.id,
      user_id: req.userId,
      request_id: req.requestId,
      before_data: beforeRow,
      after_data: voucher,
    });
    res.json({ success: true, data: voucher });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/vouchers/validate', async (req, res) => {
  try {
    await syncVoucherStatuses();
    const { code, order_amount = 0 } = req.body || {};
    if (!code) return res.status(400).json({ success: false, message: 'Thiếu mã voucher' });

    const [[voucher]] = await pool.query(
      `SELECT * FROM catalog_vouchers WHERE code = ?`,
      [String(code).toUpperCase()]
    );
    if (!voucher) return res.status(404).json({ success: false, message: 'Voucher không tồn tại' });
    if (voucher.status !== 'active') return res.status(400).json({ success: false, message: 'Voucher không khả dụng' });
    if (voucher.valid_from && new Date(voucher.valid_from) > new Date()) return res.status(400).json({ success: false, message: 'Voucher chưa đến thời gian sử dụng' });
    if (voucher.valid_to && new Date(voucher.valid_to) < new Date()) return res.status(400).json({ success: false, message: 'Voucher đã hết hạn' });
    if (voucher.usage_limit > 0 && voucher.usage_count >= voucher.usage_limit) return res.status(400).json({ success: false, message: 'Voucher đã hết lượt sử dụng' });
    if (Number(order_amount) < Number(voucher.min_order_amount || 0)) return res.status(400).json({ success: false, message: 'Chưa đạt giá trị đơn tối thiểu để áp dụng voucher' });

    let discountAmount = 0;
    if (voucher.discount_type === 'fixed') discountAmount = Number(voucher.discount_value);
    else if (voucher.discount_type === 'percent') {
      discountAmount = (Number(order_amount) * Number(voucher.discount_value)) / 100;
      if (voucher.max_discount) discountAmount = Math.min(discountAmount, Number(voucher.max_discount));
    } else if (voucher.discount_type === 'freeship') discountAmount = Number(voucher.discount_value || 0);

    res.json({
      success: true,
      data: {
        code: voucher.code,
        discount_amount: Math.round(discountAmount),
        message: `Giam ${Math.round(discountAmount).toLocaleString('vi-VN')} VND`
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post(
  '/vouchers/:id/consume',
  canManagePromotions,
  requireFields(['quantity', 'idempotency_key']),
  validateNumberRange('quantity', { min: 1 }),
  async (req, res) => {
    const conn = await pool.getConnection();
    try {
      const id = Number(req.params.id);
      const quantity = Number(req.body.quantity || 1);
      const idempotencyKey = String(req.body.idempotency_key || '').trim();
      if (!idempotencyKey) {
        return res.status(400).json({ success: false, message: 'Thiếu idempotency_key' });
      }

      await conn.query('START TRANSACTION');
      const [[existingKey]] = await conn.query(
        `SELECT response_data
         FROM catalog_idempotency_keys
         WHERE idempotency_scope = 'voucher_consume' AND idempotency_key = ?`,
        [idempotencyKey]
      );
      if (existingKey) {
        await conn.query('COMMIT');
        return res.json({
          success: true,
          data: typeof existingKey.response_data === 'string'
            ? JSON.parse(existingKey.response_data)
            : existingKey.response_data
        });
      }

      const [[voucher]] = await conn.query(
        `SELECT * FROM catalog_vouchers WHERE id = ? FOR UPDATE`,
        [id]
      );
      if (!voucher) {
        await conn.query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'Không tìm thấy voucher' });
      }

      // Evaluate business status right before consume.
      if (voucher.valid_to && new Date(voucher.valid_to) < new Date()) {
        await conn.query(`UPDATE catalog_vouchers SET status = 'expired' WHERE id = ?`, [id]);
        await conn.query('COMMIT');
        return res.status(400).json({ success: false, message: 'Voucher đã hết hạn' });
      }
      if (voucher.usage_limit > 0 && voucher.usage_count >= voucher.usage_limit) {
        await conn.query(`UPDATE catalog_vouchers SET status = 'used_up' WHERE id = ?`, [id]);
        await conn.query('COMMIT');
        return res.status(400).json({ success: false, message: 'Voucher đã hết lượt sử dụng' });
      }
      if (voucher.status !== 'active') {
        await conn.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'Voucher không khả dụng để ghi nhận usage' });
      }
      if (voucher.usage_limit > 0 && voucher.usage_count + quantity > voucher.usage_limit) {
        await conn.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'Vượt quá số lượt sử dụng còn lại' });
      }

      await conn.query(
        `UPDATE catalog_vouchers
         SET usage_count = usage_count + ?
         WHERE id = ?`,
        [quantity, id]
      );
      const [[updated]] = await conn.query(`SELECT * FROM catalog_vouchers WHERE id = ?`, [id]);
      if (updated.usage_limit > 0 && updated.usage_count >= updated.usage_limit) {
        await conn.query(`UPDATE catalog_vouchers SET status = 'used_up' WHERE id = ?`, [id]);
        updated.status = 'used_up';
      }

      const responseData = {
        voucher_id: updated.id,
        code: updated.code,
        usage_count: updated.usage_count,
        status: updated.status,
        idempotency_key: idempotencyKey
      };
      await conn.query(
        `INSERT INTO catalog_idempotency_keys
          (idempotency_scope, idempotency_key, request_hash, response_data)
         VALUES ('voucher_consume', ?, SHA2(?, 256), ?)`,
        [idempotencyKey, JSON.stringify(req.body || {}), JSON.stringify(responseData)]
      );
      await writeAudit({
        action: 'voucher_consume',
        entity_type: 'catalog_voucher',
        entity_id: updated.id,
        user_id: req.userId,
        request_id: req.requestId,
        before_data: voucher,
        after_data: updated,
        metadata: { quantity, idempotency_key: idempotencyKey }
      }, conn);
      await conn.query('COMMIT');
      res.json({ success: true, data: responseData });
    } catch (err) {
      await conn.query('ROLLBACK');
      res.status(500).json({ success: false, message: err.message });
    } finally {
      conn.release();
    }
  }
);

router.get('/gifts', canManagePromotions, async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT g.*, p.name AS gift_product_name
       FROM catalog_gift_campaigns g
       LEFT JOIN products p ON p.id = g.gift_product_id
       ORDER BY g.created_at DESC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/gifts', canManagePromotions, async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.name || !body.rule?.gift_product_id) {
      return res.status(400).json({ success: false, message: 'Thiếu name hoặc rule.gift_product_id' });
    }
    const [result] = await pool.query(
      `INSERT INTO catalog_gift_campaigns (name, min_order_amount, gift_product_id, max_per_customer, valid_from, valid_to, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        body.name, Number(body.rule.min_order || 0), Number(body.rule.gift_product_id), Number(body.rule.max_per_customer || 1),
        body.valid_from || null, body.valid_to || null, body.status || 'active'
      ]
    );
    const [[gift]] = await pool.query(`SELECT * FROM catalog_gift_campaigns WHERE id = ?`, [result.insertId]);
    res.status(201).json({ success: true, data: gift });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/gifts/:id', canManagePromotions, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = req.body || {};
    const fields = [];
    const params = [];
    if (body.name !== undefined) { fields.push('name = ?'); params.push(body.name); }
    if (body.rule?.min_order !== undefined) { fields.push('min_order_amount = ?'); params.push(Number(body.rule.min_order)); }
    if (body.rule?.gift_product_id !== undefined) { fields.push('gift_product_id = ?'); params.push(Number(body.rule.gift_product_id)); }
    if (body.rule?.max_per_customer !== undefined) { fields.push('max_per_customer = ?'); params.push(Number(body.rule.max_per_customer)); }
    if (body.valid_from !== undefined) { fields.push('valid_from = ?'); params.push(body.valid_from || null); }
    if (body.valid_to !== undefined) { fields.push('valid_to = ?'); params.push(body.valid_to || null); }
    if (body.status !== undefined) { fields.push('status = ?'); params.push(body.status); }
    if (!fields.length) return res.status(400).json({ success: false, message: 'Không có trường để cập nhật' });
    const [result] = await pool.query(`UPDATE catalog_gift_campaigns SET ${fields.join(', ')} WHERE id = ?`, [...params, id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Không tìm thấy chiến dịch quà tặng' });
    const [[gift]] = await pool.query(`SELECT * FROM catalog_gift_campaigns WHERE id = ?`, [id]);
    res.json({ success: true, data: gift });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/gifts/:id/toggle', canManagePromotions, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const status = req.body?.status;
    if (!['active', 'paused'].includes(status)) return res.status(400).json({ success: false, message: 'status phải là active hoặc paused' });
    const [result] = await pool.query(`UPDATE catalog_gift_campaigns SET status = ? WHERE id = ?`, [status, id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Không tìm thấy chiến dịch quà tặng' });
    res.json({ success: true, message: 'Cập nhật trạng thái thành công' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/gifts/:id/clone', canManagePromotions, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [[gift]] = await pool.query(`SELECT * FROM catalog_gift_campaigns WHERE id = ?`, [id]);
    if (!gift) return res.status(404).json({ success: false, message: 'Không tìm thấy chiến dịch quà tặng' });
    const [result] = await pool.query(
      `INSERT INTO catalog_gift_campaigns (name, min_order_amount, gift_product_id, max_per_customer, usage_count, status, valid_from, valid_to)
       VALUES (?, ?, ?, ?, 0, 'paused', ?, ?)`,
      [`${gift.name} (clone)`, gift.min_order_amount, gift.gift_product_id, gift.max_per_customer, gift.valid_from, gift.valid_to]
    );
    const [[cloned]] = await pool.query(`SELECT * FROM catalog_gift_campaigns WHERE id = ?`, [result.insertId]);
    res.status(201).json({ success: true, data: cloned });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/loyalty/config', canManagePromotions, async (_req, res) => {
  try {
    const [[row]] = await pool.query(`SELECT * FROM catalog_loyalty_config ORDER BY id ASC LIMIT 1`);
    if (!row) return res.json({ success: true, data: null });
    res.json({
      success: true,
      data: {
        tiers: typeof row.tiers === 'string' ? JSON.parse(row.tiers) : row.tiers,
        redemption: typeof row.redemption === 'string' ? JSON.parse(row.redemption) : row.redemption,
        channels: typeof row.channels === 'string' ? JSON.parse(row.channels) : row.channels
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/loyalty/config', canManagePromotions, async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.tiers || !body.redemption || !body.channels) {
      return res.status(400).json({ success: false, message: 'Thiếu tiers/redemption/channels' });
    }
    await pool.query(
      `INSERT INTO catalog_loyalty_config (id, tiers, redemption, channels)
       VALUES (1, ?, ?, ?)
       ON DUPLICATE KEY UPDATE tiers = VALUES(tiers), redemption = VALUES(redemption), channels = VALUES(channels)`,
      [JSON.stringify(body.tiers), JSON.stringify(body.redemption), JSON.stringify(body.channels)]
    );
    res.json({ success: true, data: body });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/export', canManagePromotions, async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, code, name, discount_type, discount_value, usage_count, usage_limit, status, valid_from, valid_to
       FROM catalog_vouchers
       ORDER BY created_at DESC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
