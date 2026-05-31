const router = require('express').Router();
const pool   = require('../db/pool');

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
              bi.status, bi.location_id,
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

module.exports = router;
