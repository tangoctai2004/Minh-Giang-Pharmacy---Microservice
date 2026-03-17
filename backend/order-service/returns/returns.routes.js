const router = require('express').Router();
const pool   = require('../db/pool');

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, code, order_id, status, reason, total_refund, created_at
       FROM returns ORDER BY created_at DESC LIMIT 50`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const [[ret]] = await pool.query('SELECT * FROM returns WHERE id = ?', [req.params.id]);
    if (!ret) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn trả hàng' });
    const [items] = await pool.query('SELECT * FROM return_items WHERE return_id = ?', [req.params.id]);
    res.json({ success: true, data: { ...ret, items } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/',            (req, res) => res.status(501).json({ success: false, message: 'TODO: POST /returns — tạo yêu cầu trả hàng' }));
router.put('/:id/approve',  (req, res) => res.status(501).json({ success: false, message: 'TODO: PUT /returns/:id/approve' }));
router.put('/:id/reject',   (req, res) => res.status(501).json({ success: false, message: 'TODO: PUT /returns/:id/reject' }));

module.exports = router;
