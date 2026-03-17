const router = require('express').Router();
const pool   = require('../db/pool');

// GET /categories — Cây danh mục (public)
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, slug, parent_id, image_url, sort_order
       FROM categories WHERE is_active = 1
       ORDER BY sort_order ASC, id ASC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM categories WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Không tìm thấy danh mục' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/',     (req, res) => res.status(501).json({ success: false, message: 'TODO: POST /categories' }));
router.put('/:id',   (req, res) => res.status(501).json({ success: false, message: 'TODO: PUT /categories/:id' }));
router.delete('/:id',(req, res) => res.status(501).json({ success: false, message: 'TODO: DELETE /categories/:id' }));

module.exports = router;
