const router = require('express').Router();
const pool   = require('../db/pool');
const requireRoles = require('../middlewares/requireRoles');
const { writeAudit } = require('../services/audit.service');
const cache = require('../utils/cache');
const canWriteCatalog = requireRoles(['admin', 'manager']);

function auditCode() {
  const now = new Date();
  const date = now.toISOString().slice(2, 10).replace(/-/g, '');
  return `AUD-${date}-${String(Date.now()).slice(-4)}`;
}

function batchStatusByQuantity(expiryDate, quantity) {
  if (Number(quantity) <= 0) return 'depleted';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(`${String(expiryDate).slice(0, 10)}T00:00:00`);
  if (!Number.isNaN(expiry.getTime()) && expiry < today) return 'expired';
  if (!Number.isNaN(expiry.getTime())) {
    const days = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
    if (days <= 90) return 'near_expiry';
  }
  return 'available';
}

function normalizeAuditItems(items = []) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({
    id: Number(item.id),
    actual_quantity: item.actual_quantity === '' || item.actual_quantity === null || item.actual_quantity === undefined
      ? null
      : Number(item.actual_quantity),
    notes: String(item.notes || '').trim() || null
  }));
}

// GET /inventory/stats — Số liệu tổng quan tồn kho
router.get('/stats', async (_req, res) => {
  try {
    const [[overview]] = await pool.query(
      `SELECT
         COUNT(*) AS total_products,
         SUM(CASE WHEN COALESCE(stock.total_stock, 0) > 0 THEN 1 ELSE 0 END) AS in_stock_products,
         SUM(CASE WHEN COALESCE(stock.total_stock, 0) = 0 THEN 1 ELSE 0 END) AS out_of_stock_products,
         SUM(CASE WHEN COALESCE(stock.total_stock, 0) > 0 AND COALESCE(stock.total_stock, 0) <= p.min_stock_alert THEN 1 ELSE 0 END) AS low_stock_products,
         COALESCE(SUM(COALESCE(stock.total_stock, 0)), 0) AS total_units_in_stock
       FROM products p
       LEFT JOIN (
         SELECT product_id, COALESCE(SUM(quantity_remaining), 0) AS total_stock
         FROM batch_items
         WHERE status IN ('available', 'near_expiry')
         GROUP BY product_id
       ) stock ON stock.product_id = p.id
       WHERE p.status = 'active'`
    );

    const [[expiry]] = await pool.query(
      `SELECT
         SUM(CASE WHEN status = 'near_expiry' THEN 1 ELSE 0 END) AS near_expiry_batches,
         SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) AS expired_batches,
         COALESCE(SUM(CASE
           WHEN status IN ('available', 'near_expiry')
           THEN quantity_remaining * cost_price
           ELSE 0
         END), 0) AS total_inventory_cost
       FROM batch_items`
    );

    res.json({
      success: true,
      data: {
        ...overview,
        near_expiry_batches: Number(expiry.near_expiry_batches || 0),
        expired_batches: Number(expiry.expired_batches || 0),
        total_inventory_cost: Number(expiry.total_inventory_cost || 0),
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /inventory — Tổng quan tồn kho theo sản phẩm
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.id AS product_id, p.sku, p.name, p.base_unit,
              COALESCE(SUM(bi.quantity_remaining), 0) AS stock_total,
              MIN(bi.expiry_date) AS nearest_expiry
       FROM products p
       LEFT JOIN batch_items bi ON bi.product_id = p.id
           AND bi.status IN ('available', 'near_expiry')
       WHERE p.status = 'active'
       GROUP BY p.id, p.sku, p.name, p.base_unit
       ORDER BY p.name ASC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /inventory/audits — Lịch sử phiếu kiểm kê
router.get('/audits', async (req, res) => {
  try {
    const status = req.query.status || '';
    const locationId = req.query.location_id ? Number(req.query.location_id) : null;
    const params = [];
    let where = 'WHERE 1 = 1';
    if (status) {
      if (!['draft', 'reconciled'].includes(status)) {
        return res.status(400).json({ success: false, message: 'status không hợp lệ' });
      }
      where += ' AND ia.status = ?';
      params.push(status);
    }
    if (locationId) {
      where += ' AND ia.location_id = ?';
      params.push(locationId);
    }

    const [rows] = await pool.query(
      `SELECT ia.id, ia.audit_code, ia.location_id, ia.total_items,
              ia.total_missing, ia.total_surplus, ia.total_value_diff,
              ia.status, ia.notes, ia.created_by, ia.reconciled_by,
              ia.reconciled_at, ia.created_at,
              CONCAT(l.zone, ' / ', l.cabinet, ' / ', l.shelf) AS location_name
       FROM inventory_audits ia
       LEFT JOIN locations l ON l.id = ia.location_id
       ${where}
       ORDER BY ia.created_at DESC
       LIMIT 100`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /inventory/audits — Tạo snapshot kiểm kê theo toàn kho hoặc một vị trí
router.post('/audits', canWriteCatalog, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const locationId = req.body?.location_id ? Number(req.body.location_id) : null;
    const notes = String(req.body?.notes || '').trim() || null;

    await conn.query('START TRANSACTION');
    if (locationId) {
      const [[location]] = await conn.query(
        `SELECT id FROM locations WHERE id = ? AND is_active = 1`,
        [locationId]
      );
      if (!location) {
        await conn.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'Vị trí kiểm kê không tồn tại hoặc đã ngừng dùng' });
      }
    }

    const params = [];
    let where = `WHERE bi.status IN ('available', 'near_expiry') AND bi.quantity_remaining > 0`;
    if (locationId) {
      where += ' AND bi.location_id = ?';
      params.push(locationId);
    }

    const [stockRows] = await conn.query(
      `SELECT bi.id AS batch_item_id, bi.product_id, bi.quantity_remaining
       FROM batch_items bi
       JOIN products p ON p.id = bi.product_id AND p.status = 'active'
       ${where}
       ORDER BY p.name ASC, bi.expiry_date ASC, bi.id ASC
       FOR UPDATE`,
      params
    );

    if (!stockRows.length) {
      await conn.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Không có tồn kho khả dụng để tạo phiếu kiểm kê' });
    }

    const [auditResult] = await conn.query(
      `INSERT INTO inventory_audits (
        audit_code, location_id, total_items, status, notes, created_by
      ) VALUES (?, ?, ?, 'draft', ?, ?)`,
      [auditCode(), locationId, stockRows.length, notes, req.userId || 0]
    );

    if (stockRows.length > 0) {
      const auditId = auditResult.insertId;
      const values = stockRows.map((row) => [
        auditId,
        row.batch_item_id,
        row.product_id,
        row.quantity_remaining
      ]);
      await conn.query(
        `INSERT INTO audit_items (
          audit_id, batch_item_id, product_id, system_quantity
        ) VALUES ?`,
        [values]
      );
    }

    await conn.query('COMMIT');
    await writeAudit({
      action: 'inventory_audit_create',
      entity_type: 'inventory_audit',
      entity_id: auditResult.insertId,
      user_id: req.userId,
      request_id: req.requestId,
      after_data: { id: auditResult.insertId, location_id: locationId, total_items: stockRows.length }
    });
    res.status(201).json({ success: true, data: { id: auditResult.insertId } });
  } catch (err) {
    try { await conn.query('ROLLBACK'); } catch (_rollbackErr) {}
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

// GET /inventory/audits/:id — Chi tiết phiếu kiểm kê
router.get('/audits/:id', async (req, res) => {
  try {
    const [[audit]] = await pool.query(
      `SELECT ia.*,
              CONCAT(l.zone, ' / ', l.cabinet, ' / ', l.shelf) AS location_name
       FROM inventory_audits ia
       LEFT JOIN locations l ON l.id = ia.location_id
       WHERE ia.id = ?`,
      [req.params.id]
    );
    if (!audit) return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu kiểm kê' });

    const [items] = await pool.query(
      `SELECT ai.id, ai.batch_item_id, ai.product_id, ai.system_quantity,
              ai.actual_quantity, ai.difference_quantity, ai.notes,
              p.sku, p.name AS product_name, p.base_unit,
              bi.lot_number, bi.expiry_date, bi.cost_price,
              CONCAT(l.zone, ' / ', l.cabinet, ' / ', l.shelf) AS location_name
       FROM audit_items ai
       JOIN batch_items bi ON bi.id = ai.batch_item_id
       JOIN products p ON p.id = ai.product_id
       LEFT JOIN locations l ON l.id = bi.location_id
       WHERE ai.audit_id = ?
       ORDER BY p.name ASC, bi.expiry_date ASC, ai.id ASC`,
      [req.params.id]
    );

    res.json({ success: true, data: { ...audit, items } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /inventory/audits/:id/items — Lưu số lượng đếm thực tế cho phiếu nháp
router.put('/audits/:id/items', canWriteCatalog, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const auditId = Number(req.params.id);
    const items = normalizeAuditItems(req.body?.items);
    if (!Number.isInteger(auditId) || auditId <= 0) {
      return res.status(400).json({ success: false, message: 'id phiếu kiểm kê không hợp lệ' });
    }
    if (!items.length) {
      return res.status(400).json({ success: false, message: 'Danh sách dòng kiểm kê không được rỗng' });
    }
    if (items.some((item) => !Number.isInteger(item.id) || item.id <= 0 || (item.actual_quantity !== null && (!Number.isInteger(item.actual_quantity) || item.actual_quantity < 0)))) {
      return res.status(400).json({ success: false, message: 'Dữ liệu số lượng kiểm kê không hợp lệ' });
    }

    await conn.query('START TRANSACTION');
    const [[audit]] = await conn.query(
      `SELECT id, status FROM inventory_audits WHERE id = ? FOR UPDATE`,
      [auditId]
    );
    if (!audit) {
      await conn.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu kiểm kê' });
    }
    if (audit.status !== 'draft') {
      await conn.query('ROLLBACK');
      return res.status(409).json({ success: false, message: 'Phiếu đã đối soát thì không thể sửa' });
    }

    const itemIds = items.map((it) => it.id);
    let existingItemsMap = {};
    if (itemIds.length > 0) {
      const [existingItems] = await conn.query(
        `SELECT id, system_quantity FROM audit_items WHERE audit_id = ? AND id IN (?)`,
        [auditId, itemIds]
      );
      existingItems.forEach((existingItem) => {
        existingItemsMap[existingItem.id] = existingItem;
      });
    }

    for (const item of items) {
      const existingItem = existingItemsMap[item.id];
      if (!existingItem) {
        await conn.query('ROLLBACK');
        return res.status(400).json({ success: false, message: `Dòng kiểm kê #${item.id} không thuộc phiếu này` });
      }
      const diff = item.actual_quantity === null ? null : item.actual_quantity - Number(existingItem.system_quantity);
      await conn.query(
        `UPDATE audit_items
         SET actual_quantity = ?, difference_quantity = ?, notes = ?
         WHERE id = ?`,
        [item.actual_quantity, diff, item.notes, item.id]
      );
    }

    await conn.query('COMMIT');
    res.json({ success: true, message: 'Đã lưu số lượng kiểm kê' });
  } catch (err) {
    try { await conn.query('ROLLBACK'); } catch (_rollbackErr) {}
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

// POST /inventory/audits/:id/reconcile — Khoá phiếu và điều chỉnh tồn theo thực tế
router.post('/audits/:id/reconcile', canWriteCatalog, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const auditId = Number(req.params.id);
    const items = normalizeAuditItems(req.body?.items);
    if (!Number.isInteger(auditId) || auditId <= 0) {
      return res.status(400).json({ success: false, message: 'id phiếu kiểm kê không hợp lệ' });
    }

    await conn.query('START TRANSACTION');
    const [[audit]] = await conn.query(
      `SELECT id, status FROM inventory_audits WHERE id = ? FOR UPDATE`,
      [auditId]
    );
    if (!audit) {
      await conn.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu kiểm kê' });
    }
    if (audit.status !== 'draft') {
      await conn.query('ROLLBACK');
      return res.status(409).json({ success: false, message: 'Phiếu kiểm kê đã được đối soát' });
    }

    if (items.length) {
      const itemIds = items.map((it) => it.id);
      let existingItemsMap = {};
      const [existingItems] = await conn.query(
        `SELECT id, system_quantity FROM audit_items WHERE audit_id = ? AND id IN (?)`,
        [auditId, itemIds]
      );
      existingItems.forEach((existingItem) => {
        existingItemsMap[existingItem.id] = existingItem;
      });

      for (const item of items) {
        if (!Number.isInteger(item.id) || item.id <= 0 || !Number.isInteger(item.actual_quantity) || item.actual_quantity < 0) {
          await conn.query('ROLLBACK');
          return res.status(400).json({ success: false, message: 'Dữ liệu số lượng kiểm kê không hợp lệ' });
        }
        const existingItem = existingItemsMap[item.id];
        if (!existingItem) {
          await conn.query('ROLLBACK');
          return res.status(400).json({ success: false, message: `Dòng kiểm kê #${item.id} không thuộc phiếu này` });
        }
        const diff = item.actual_quantity - Number(existingItem.system_quantity);
        if (diff !== 0 && !item.notes) {
          await conn.query('ROLLBACK');
          return res.status(400).json({ success: false, message: 'Dòng kiểm kê có chênh lệch bắt buộc nhập lý do' });
        }
        await conn.query(
          `UPDATE audit_items
           SET actual_quantity = ?, difference_quantity = ?, notes = ?
           WHERE id = ?`,
          [item.actual_quantity, diff, item.notes, item.id]
        );
      }
    }

    const [[{ missingCount }]] = await conn.query(
      `SELECT COUNT(*) AS missingCount FROM audit_items WHERE audit_id = ? AND actual_quantity IS NULL`,
      [auditId]
    );
    if (Number(missingCount) > 0) {
      await conn.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Vẫn còn dòng chưa nhập số lượng thực tế' });
    }

    const [auditRows] = await conn.query(
      `SELECT ai.id, ai.batch_item_id, ai.product_id, ai.system_quantity,
              ai.actual_quantity, ai.difference_quantity, ai.notes,
              bi.expiry_date, bi.cost_price
       FROM audit_items ai
       JOIN batch_items bi ON bi.id = ai.batch_item_id
       WHERE ai.audit_id = ?
       ORDER BY ai.id ASC
       FOR UPDATE`,
      [auditId]
    );

    let totalMissing = 0;
    let totalSurplus = 0;
    let totalValueDiff = 0;
    for (const row of auditRows) {
      const diff = Number(row.difference_quantity || 0);
      if (diff < 0) totalMissing += Math.abs(diff);
      if (diff > 0) totalSurplus += diff;
      totalValueDiff += diff * Number(row.cost_price || 0);
      if (diff !== 0) {
        await conn.query(
          `UPDATE batch_items
           SET quantity_remaining = ?,
               status = ?
           WHERE id = ?`,
          [
            Number(row.actual_quantity),
            batchStatusByQuantity(row.expiry_date, row.actual_quantity),
            row.batch_item_id
          ]
        );
        await conn.query(
          `INSERT INTO stock_movements (
            movement_code, batch_item_id, product_id, movement_type, quantity,
            reference_type, reference_id, reason, created_by
          ) VALUES (?, ?, ?, 'adjustment', ?, 'adjustment', ?, ?, ?)`,
          [
            `ADJ-${auditId}-${row.id}`,
            row.batch_item_id,
            row.product_id,
            diff,
            auditId,
            row.notes || 'Điều chỉnh tồn sau kiểm kê',
            req.userId || null
          ]
        );
      }
    }

    await conn.query(
      `UPDATE inventory_audits
       SET total_items = ?, total_missing = ?, total_surplus = ?,
           total_value_diff = ?, status = 'reconciled',
           reconciled_by = ?, reconciled_at = NOW()
       WHERE id = ?`,
      [auditRows.length, totalMissing, totalSurplus, totalValueDiff, req.userId || null, auditId]
    );

    await conn.query('COMMIT');
    await cache.clearByPrefix('products:').catch(err => console.error('Cache clear error:', err));
    await writeAudit({
      action: 'inventory_audit_reconcile',
      entity_type: 'inventory_audit',
      entity_id: auditId,
      user_id: req.userId,
      request_id: req.requestId,
      after_data: { id: auditId, total_missing: totalMissing, total_surplus: totalSurplus, total_value_diff: totalValueDiff }
    });
    res.json({
      success: true,
      data: {
        id: auditId,
        total_items: auditRows.length,
        total_missing: totalMissing,
        total_surplus: totalSurplus,
        total_value_diff: totalValueDiff
      }
    });
  } catch (err) {
    try { await conn.query('ROLLBACK'); } catch (_rollbackErr) {}
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

// GET /inventory/availability — Tồn kho có thể bán sau khi trừ hàng đang giữ
router.get('/availability', async (req, res) => {
  try {
    const productIds = req.query.product_ids
      ? req.query.product_ids.split(',').map(Number).filter((id) => Number.isInteger(id) && id > 0)
      : [];

    if (req.query.product_ids && productIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    let where = "WHERE p.status = 'active'";
    const params = [];
    if (productIds.length > 0) {
      where += ` AND p.id IN (${productIds.map(() => '?').join(',')})`;
      params.push(...productIds);
    }

    const [rows] = await pool.query(
      `SELECT p.id AS product_id, p.sku, p.name, p.base_unit,
              COALESCE(SUM(CASE
                WHEN bi.status IN ('available', 'near_expiry')
                THEN bi.quantity_remaining
                ELSE 0
              END), 0) AS total_stock,
              COALESCE(SUM(CASE
                WHEN bi.status IN ('available', 'near_expiry')
                THEN COALESCE((
                  SELECT SUM(sr.quantity)
                  FROM stock_reservations sr
                  WHERE sr.batch_item_id = bi.id
                    AND sr.released_at IS NULL
                    AND sr.expires_at > NOW()
                ), 0)
                ELSE 0
              END), 0) AS reserved_stock,
              COALESCE(SUM(CASE
                WHEN bi.status IN ('available', 'near_expiry')
                THEN GREATEST(
                  bi.quantity_remaining - COALESCE((
                    SELECT SUM(sr.quantity)
                    FROM stock_reservations sr
                    WHERE sr.batch_item_id = bi.id
                      AND sr.released_at IS NULL
                      AND sr.expires_at > NOW()
                  ), 0),
                  0
                )
                ELSE 0
              END), 0) AS available_stock,
              MIN(CASE
                WHEN bi.status IN ('available', 'near_expiry') AND bi.quantity_remaining > 0
                THEN bi.expiry_date
                ELSE NULL
              END) AS nearest_expiry,
              SUBSTRING_INDEX(
                GROUP_CONCAT(
                  CASE
                    WHEN bi.status IN ('available', 'near_expiry') AND bi.quantity_remaining > 0
                    THEN CONCAT_WS(' / ', l.zone, l.cabinet, l.shelf)
                    ELSE NULL
                  END
                  ORDER BY bi.expiry_date ASC SEPARATOR '||'
                ),
                '||',
                1
              ) AS location_name
       FROM products p
       LEFT JOIN batch_items bi ON bi.product_id = p.id
       LEFT JOIN locations l ON l.id = bi.location_id
       ${where}
       GROUP BY p.id, p.sku, p.name, p.base_unit
       ORDER BY p.name ASC`,
      params
    );

    const data = rows.map((row) => ({
      ...row,
      total_stock: Number(row.total_stock || 0),
      reserved_stock: Number(row.reserved_stock || 0),
      available_stock: Number(row.available_stock || 0),
      in_stock: Number(row.available_stock || 0) > 0,
    }));

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /inventory/reservations — Giữ tồn tạm thời cho POS/Order theo FEFO
router.post('/reservations', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const {
      items = [],
      source_type = 'pos_hold',
      source_id,
      ttl_minutes = 30
    } = req.body || {};

    const allowedSourceTypes = ['pos_hold', 'web_checkout', 'pos_checkout'];
    if (!allowedSourceTypes.includes(source_type)) {
      return res.status(400).json({ success: false, message: 'source_type không hợp lệ' });
    }
    if (!Number.isInteger(Number(source_id)) || Number(source_id) <= 0) {
      return res.status(400).json({ success: false, message: 'source_id không hợp lệ' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Danh sách sản phẩm giữ hàng không được rỗng' });
    }

    const normalizedItems = items.map((item) => ({
      product_id: Number(item.product_id),
      quantity: Number(item.quantity)
    }));
    if (normalizedItems.some((item) =>
      !Number.isInteger(item.product_id) || item.product_id <= 0 ||
      !Number.isInteger(item.quantity) || item.quantity <= 0
    )) {
      return res.status(400).json({ success: false, message: 'product_id hoặc quantity không hợp lệ' });
    }

    const ttl = Math.min(120, Math.max(1, Number(ttl_minutes) || 30));
    const reservedBy = req.userId ? Number(req.userId) : null;
    const reservations = [];

    await conn.query('START TRANSACTION');
    await conn.query(
      `UPDATE stock_reservations
       SET released_at = NOW(), release_reason = 'expired'
       WHERE released_at IS NULL AND expires_at <= NOW()`
    );

    for (const item of normalizedItems) {
      let remaining = item.quantity;
      const [batches] = await conn.query(
        `SELECT bi.id AS batch_item_id, bi.product_id, bi.lot_number, bi.expiry_date,
                bi.quantity_remaining,
                GREATEST(
                  bi.quantity_remaining - COALESCE((
                    SELECT SUM(sr.quantity)
                    FROM stock_reservations sr
                    WHERE sr.batch_item_id = bi.id
                      AND sr.released_at IS NULL
                      AND sr.expires_at > NOW()
                  ), 0),
                  0
                ) AS available_stock
         FROM batch_items bi
         JOIN products p ON p.id = bi.product_id AND p.status = 'active'
         WHERE bi.product_id = ?
           AND bi.status IN ('available', 'near_expiry')
           AND bi.quantity_remaining > 0
         ORDER BY bi.expiry_date ASC, bi.id ASC
         FOR UPDATE`,
        [item.product_id]
      );

      const totalAvailable = batches.reduce((sum, batch) => sum + Number(batch.available_stock || 0), 0);
      if (totalAvailable < item.quantity) {
        await conn.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          message: 'Tồn có thể bán không đủ để giữ hàng',
          data: {
            product_id: item.product_id,
            requested_quantity: item.quantity,
            available_stock: totalAvailable
          }
        });
      }

      for (const batch of batches) {
        if (remaining <= 0) break;
        const takeQty = Math.min(remaining, Number(batch.available_stock || 0));
        if (takeQty <= 0) continue;
        const [result] = await conn.query(
          `INSERT INTO stock_reservations (
             batch_item_id, product_id, quantity, source_type, source_id,
             reserved_by, expires_at
           ) VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
          [
            batch.batch_item_id,
            item.product_id,
            takeQty,
            source_type,
            Number(source_id),
            reservedBy,
            ttl
          ]
        );
        reservations.push({
          id: result.insertId,
          product_id: item.product_id,
          batch_item_id: batch.batch_item_id,
          lot_number: batch.lot_number,
          expiry_date: batch.expiry_date,
          quantity: takeQty,
        });
        remaining -= takeQty;
      }
    }

    await conn.query('COMMIT');
    res.status(201).json({
      success: true,
      data: {
        source_type,
        source_id: Number(source_id),
        ttl_minutes: ttl,
        reservations
      }
    });
  } catch (err) {
    try { await conn.query('ROLLBACK'); } catch (_rollbackErr) {}
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

// POST /inventory/reservations/release — Giải phóng giữ hàng theo nguồn gọi
router.post('/reservations/release', async (req, res) => {
  try {
    const { source_type = 'pos_hold', source_id, reason = 'cancelled' } = req.body || {};
    const allowedSourceTypes = ['pos_hold', 'web_checkout', 'pos_checkout'];
    const allowedReasons = ['completed', 'cancelled', 'expired'];

    if (!allowedSourceTypes.includes(source_type)) {
      return res.status(400).json({ success: false, message: 'source_type không hợp lệ' });
    }
    if (!allowedReasons.includes(reason)) {
      return res.status(400).json({ success: false, message: 'reason không hợp lệ' });
    }
    if (!Number.isInteger(Number(source_id)) || Number(source_id) <= 0) {
      return res.status(400).json({ success: false, message: 'source_id không hợp lệ' });
    }

    const [result] = await pool.query(
      `UPDATE stock_reservations
       SET released_at = NOW(), release_reason = ?
       WHERE source_type = ?
         AND source_id = ?
         AND released_at IS NULL`,
      [reason, source_type, Number(source_id)]
    );

    res.json({
      success: true,
      data: {
        source_type,
        source_id: Number(source_id),
        released_count: result.affectedRows
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /inventory/:productId — Tồn kho theo từng lô của 1 sản phẩm
router.get('/:productId', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT bi.id, bi.batch_id, bi.lot_number, bi.expiry_date,
              bi.quantity_received, bi.quantity_remaining,
              bi.status, bi.location_id, bi.cost_price,
              CONCAT(l.zone, ' / ', l.cabinet, ' / ', l.shelf) AS location_name
       FROM batch_items bi
       LEFT JOIN locations l ON l.id = bi.location_id
       WHERE bi.product_id = ? AND bi.status NOT IN ('depleted','expired')
       ORDER BY bi.expiry_date ASC`,
      [req.params.productId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /inventory/deduct — Trừ kho theo thuật toán FEFO (với kiểm tra chống âm kho và hỗ trợ reservation)
router.post('/deduct', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const {
      items = [],
      source_type,
      source_id,
      reference_type,
      reference_id,
      created_by
    } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Danh sách sản phẩm không hợp lệ' });
    }

    await conn.query('START TRANSACTION');

    // 1. Giải phóng các reservation hết hạn
    await conn.query(
      `UPDATE stock_reservations
       SET released_at = NOW(), release_reason = 'expired'
       WHERE released_at IS NULL AND expires_at <= NOW()`
    );

    const deductedItems = [];

    // 2. Nếu có reservation, ta nạp trước các reservation này
    let reservations = [];
    if (source_type && source_id) {
      const [resRows] = await conn.query(
        `SELECT id, batch_item_id, product_id, quantity 
         FROM stock_reservations 
         WHERE source_type = ? AND source_id = ? AND released_at IS NULL AND expires_at > NOW()
         FOR UPDATE`,
        [source_type, source_id]
      );
      reservations = resRows;
    }

    // 3. Xử lý từng item cần trừ
    for (const item of items) {
      const productId = Number(item.product_id);
      let qtyToDeduct = Number(item.quantity);

      if (qtyToDeduct <= 0) continue;

      // 3.0. Nếu truyền cụ thể batch_item_id, trừ trực tiếp từ lô hàng đó
      const batchItemId = item.batch_item_id ? Number(item.batch_item_id) : null;
      if (batchItemId) {
        const [[batch]] = await conn.query(
          `SELECT id, quantity_remaining, lot_number, expiry_date, cost_price, product_id
           FROM batch_items 
           WHERE id = ? FOR UPDATE`,
          [batchItemId]
        );
        if (!batch) {
          await conn.query('ROLLBACK');
          return res.status(404).json({ success: false, message: `Không tìm thấy lô hàng #${batchItemId}` });
        }
        const newQty = Number(batch.quantity_remaining) - qtyToDeduct;
        if (newQty < 0) {
          await conn.query('ROLLBACK');
          return res.status(409).json({ 
            success: false, 
            message: `Không đủ tồn kho trong lô hàng ${batch.lot_number} (Cần trừ: ${qtyToDeduct}, hiện có: ${batch.quantity_remaining})` 
          });
        }
        await conn.query(
          `UPDATE batch_items SET quantity_remaining = ?, status = ? WHERE id = ?`,
          [newQty, batchStatusByQuantity(batch.expiry_date, newQty), batchItemId]
        );
        deductedItems.push({
          product_id: batch.product_id,
          batch_item_id: batchItemId,
          lot_number: batch.lot_number,
          quantity: qtyToDeduct,
          cost_price: Number(batch.cost_price || 0)
        });
        continue;
      }

      // 3.1. Xem có reservation cho sản phẩm này không
      const itemReservations = reservations.filter(r => Number(r.product_id) === productId);
      for (const resv of itemReservations) {
        if (qtyToDeduct <= 0) break;

        const deductQty = Math.min(qtyToDeduct, Number(resv.quantity));
        
        // Cập nhật batch item
        const [[batch]] = await conn.query(
          `SELECT quantity_remaining, lot_number, expiry_date 
           FROM batch_items WHERE id = ? FOR UPDATE`,
          [resv.batch_item_id]
        );

        if (!batch) {
          await conn.query('ROLLBACK');
          return res.status(409).json({ 
            success: false, 
            message: `Không tìm thấy lô hàng của reservation #${resv.id}` 
          });
        }

        const newQty = Number(batch.quantity_remaining) - deductQty;
        if (newQty < 0) {
          await conn.query('ROLLBACK');
          return res.status(409).json({ 
            success: false, 
            message: `Không đủ tồn kho trong lô hàng ${batch.lot_number} để thực hiện trừ từ reservation.` 
          });
        }

        await conn.query(
          `UPDATE batch_items SET quantity_remaining = ?, status = ? WHERE id = ?`,
          [newQty, batchStatusByQuantity(batch.expiry_date, newQty), resv.batch_item_id]
        );

        // Đánh dấu reservation đã hoàn thành
        await conn.query(
          `UPDATE stock_reservations SET released_at = NOW(), release_reason = 'completed' WHERE id = ?`,
          [resv.id]
        );

        deductedItems.push({
          product_id: productId,
          batch_item_id: resv.batch_item_id,
          lot_number: batch.lot_number,
          quantity: deductQty,
          cost_price: 0
        });

        qtyToDeduct -= deductQty;
      }

      // 3.2. Nếu vẫn còn lượng hàng cần trừ (chưa được cover bởi reservation, hoặc không dùng reservation)
      if (qtyToDeduct > 0) {
        // Lấy danh sách lô hàng khả dụng theo FEFO
        const [batches] = await conn.query(
          `SELECT id, quantity_remaining, lot_number, expiry_date, cost_price 
           FROM batch_items 
           WHERE product_id = ? AND quantity_remaining > 0 AND status IN ('available', 'near_expiry')
           ORDER BY expiry_date ASC
           FOR UPDATE`,
          [productId]
        );

        const totalAvailable = batches.reduce((sum, b) => sum + Number(b.quantity_remaining), 0);
        if (totalAvailable < qtyToDeduct) {
          await conn.query('ROLLBACK');
          return res.status(409).json({
            success: false,
            message: `Không đủ tồn kho khả dụng cho sản phẩm #${productId} (Cần: ${qtyToDeduct}, khả dụng: ${totalAvailable})`
          });
        }

        for (const batch of batches) {
          if (qtyToDeduct <= 0) break;

          const deductQty = Math.min(qtyToDeduct, Number(batch.quantity_remaining));
          const newQty = Number(batch.quantity_remaining) - deductQty;

          await conn.query(
            `UPDATE batch_items SET quantity_remaining = ?, status = ? WHERE id = ?`,
            [newQty, batchStatusByQuantity(batch.expiry_date, newQty), batch.id]
          );

          deductedItems.push({
            product_id: productId,
            batch_item_id: batch.id,
            lot_number: batch.lot_number,
            quantity: deductQty,
            cost_price: Number(batch.cost_price || 0)
          });

          qtyToDeduct -= deductQty;
        }
      }
    }

    // 4. Ghi nhận biến động kho (stock_movements)
    const mvtType = reference_type === 'pos_order' || reference_type === 'web_order' ? 'outbound_sale' : 'adjustment';
    for (const d of deductedItems) {
      const movementCode = `OUT-${reference_id || Date.now()}-${d.batch_item_id}`;
      await conn.query(
        `INSERT INTO stock_movements (
          movement_code, batch_item_id, product_id, movement_type, quantity,
          reference_type, reference_id, reason, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          movementCode,
          d.batch_item_id,
          d.product_id,
          mvtType,
          -d.quantity, // Số lượng âm đối với xuất kho
          reference_type || null,
          reference_id || null,
          `Xuất kho đơn hàng #${reference_id || ''}`,
          created_by || null
        ]
      );
    }

    await conn.query('COMMIT');
    await cache.clearByPrefix('products:').catch(err => console.error('Cache clear error:', err));
    res.json({
      success: true,
      message: 'Trừ kho thành công!',
      data: {
        deducted_items: deductedItems
      }
    });

  } catch (err) {
    await conn.query('ROLLBACK');
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

// POST /inventory/restock — Hoàn kho về đúng lô ban đầu (GPP Lot Traceability)
router.post('/restock', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const {
      items = [],
      reference_type,
      reference_id,
      created_by
    } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Danh sách sản phẩm hoàn kho không hợp lệ' });
    }

    await conn.query('START TRANSACTION');

    for (const item of items) {
      const batchItemId = Number(item.batch_item_id);
      const productId = Number(item.product_id);
      const quantity = Number(item.quantity);

      if (!batchItemId || !productId || quantity <= 0) {
        await conn.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'Thông tin hoàn kho của item không hợp lệ' });
      }

      // Lấy thông tin lô hàng hiện tại
      const [[batch]] = await conn.query(
        `SELECT expiry_date, quantity_remaining FROM batch_items WHERE id = ? FOR UPDATE`,
        [batchItemId]
      );

      if (!batch) {
        await conn.query('ROLLBACK');
        return res.status(404).json({ success: false, message: `Không tìm thấy lô hàng #${batchItemId}` });
      }

      const newQty = Number(batch.quantity_remaining) + quantity;
      const newStatus = batchStatusByQuantity(batch.expiry_date, newQty);

      // Cập nhật tồn kho
      await conn.query(
        `UPDATE batch_items SET quantity_remaining = ?, status = ? WHERE id = ?`,
        [newQty, newStatus, batchItemId]
      );

      // Ghi nhận biến động kho (stock_movements)
      const movementCode = `RET-${reference_id || Date.now()}-${batchItemId}`;
      await conn.query(
        `INSERT INTO stock_movements (
          movement_code, batch_item_id, product_id, movement_type, quantity,
          reference_type, reference_id, reason, created_by
        ) VALUES (?, ?, ?, 'inbound', ?, ?, ?, ?, ?)`,
        [
          movementCode,
          batchItemId,
          productId,
          quantity, // Số lượng dương đối với hoàn kho
          reference_type || 'return',
          reference_id || null,
          `Hoàn hàng/Hủy đơn về lô ban đầu`,
          created_by || null
        ]
      );
    }

    await conn.query('COMMIT');
    await cache.clearByPrefix('products:').catch(err => console.error('Cache clear error:', err));
    res.json({ success: true, message: 'Hoàn kho thành công!' });

  } catch (err) {
    await conn.query('ROLLBACK');
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

module.exports = router;

