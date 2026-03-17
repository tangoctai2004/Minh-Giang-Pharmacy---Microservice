const router = require('express').Router();
const pool   = require('../db/pool');

// GET /orders — Admin: tất cả đơn, Customer: đơn của mình
router.get('/', async (req, res) => {
  try {
    const isAdmin = req.userRole === 'admin' || req.userRole === 'pharmacist';
    let where = isAdmin ? '' : 'WHERE o.customer_id = ?';
    const params = isAdmin ? [] : [req.userId];

    const [rows] = await pool.query(
      `SELECT o.id, o.code, o.status, o.total_amount,
              o.shipping_address, o.created_at
       FROM orders o
       ${where}
       ORDER BY o.created_at DESC LIMIT 50`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /orders/my — Đơn hàng của khách đang đăng nhập
router.get('/my', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, code, status, total_amount, created_at FROM orders WHERE customer_id = ? ORDER BY created_at DESC`,
      [req.userId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /orders/:id
router.get('/:id', async (req, res) => {
  try {
    const [[order]] = await pool.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
    const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [req.params.id]);
    res.json({ success: true, data: { ...order, items } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id/confirm',  (req, res) => res.status(501).json({ success: false, message: 'TODO: PUT /orders/:id/confirm' }));
router.put('/:id/complete', (req, res) => res.status(501).json({ success: false, message: 'TODO: PUT /orders/:id/complete' }));
router.put('/:id/cancel',   (req, res) => res.status(501).json({ success: false, message: 'TODO: PUT /orders/:id/cancel' }));

module.exports = router;
