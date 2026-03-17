const router = require('express').Router();
const pool   = require('../db/pool');

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, code, name, phone, email, address, current_debt, total_purchase_value, is_active
       FROM suppliers WHERE is_active = 1 ORDER BY name`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM suppliers WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Không tìm thấy nhà cung cấp' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/',     (req, res) => res.status(501).json({ success: false, message: 'TODO: POST /suppliers' }));
router.put('/:id',   (req, res) => res.status(501).json({ success: false, message: 'TODO: PUT /suppliers/:id' }));
router.delete('/:id',(req, res) => res.status(501).json({ success: false, message: 'TODO: DELETE /suppliers/:id' }));

module.exports = router;
