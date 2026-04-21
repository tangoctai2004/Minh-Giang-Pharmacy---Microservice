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
         SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) AS expired_batches
       FROM batch_items`
    );

    res.json({
      success: true,
      data: {
        ...overview,
        near_expiry_batches: Number(expiry.near_expiry_batches || 0),
        expired_batches: Number(expiry.expired_batches || 0),
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
