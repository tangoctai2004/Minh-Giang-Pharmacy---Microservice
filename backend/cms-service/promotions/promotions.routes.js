const router = require('express').Router();
const pool   = require('../db/pool');

// GET /promotions/active — KM đang chạy (public)
router.get('/active', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, code, name, promotion_type, discount_value,
              min_order_value, max_discount_amount, start_date, end_date
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

// GET /promotions/:code — Kiểm tra mã KM cụ thể
router.get('/:code', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, code, name, promotion_type, discount_value,
              min_order_value, max_discount_amount, end_date
       FROM promotions
       WHERE code = ? AND is_active = 1 AND start_date <= NOW() AND end_date >= NOW()
         AND (usage_limit IS NULL OR usage_count < usage_limit)`,
      [req.params.code.toUpperCase()]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Mã khuyến mãi không hợp lệ hoặc đã hết hạn' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/',      async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM promotions ORDER BY created_at DESC LIMIT 50');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
router.post('/',     (req, res) => res.status(501).json({ success: false, message: 'TODO: POST /promotions' }));
router.put('/:id',   (req, res) => res.status(501).json({ success: false, message: 'TODO: PUT /promotions/:id' }));
router.delete('/:id',(req, res) => res.status(501).json({ success: false, message: 'TODO: DELETE /promotions/:id' }));

module.exports = router;
