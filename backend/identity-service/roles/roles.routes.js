const router = require('express').Router();
const pool   = require('../db/pool');

// GET /roles — Danh sách vai trò
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name, description FROM roles ORDER BY id');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /roles/:id
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM roles WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Không tìm thấy vai trò' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/',     async (req, res) => res.status(501).json({ success: false, message: 'TODO: POST /roles' }));
router.put('/:id',   async (req, res) => res.status(501).json({ success: false, message: 'TODO: PUT /roles/:id' }));
router.delete('/:id',async (req, res) => res.status(501).json({ success: false, message: 'TODO: DELETE /roles/:id' }));

module.exports = router;
