const router = require('express').Router();
const pool   = require('../db/pool');

// GET /inventory — Tổng quan tồn kho theo sản phẩm
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.id AS product_id, p.code, p.name, p.unit,
              COALESCE(SUM(bi.quantity_remaining), 0) AS stock_total,
              MIN(bi.expiry_date) AS nearest_expiry
       FROM products p
       LEFT JOIN batch_items bi ON bi.product_id = p.id
           AND bi.status IN ('available', 'near_expiry')
       WHERE p.is_active = 1
       GROUP BY p.id, p.code, p.name, p.unit
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
              bi.status, bi.location_id, l.name AS location_name
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
