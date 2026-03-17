const router = require('express').Router();
const pool   = require('../db/pool');

// GET /banners (public)
router.get('/', async (req, res) => {
  try {
    const placement = req.query.placement || null;
    let sql = `SELECT id, title, image_url, link_url, placement, sort_order
               FROM banners WHERE is_active = 1`;
    const params = [];
    if (placement) { sql += ' AND placement = ?'; params.push(placement); }
    sql += ' ORDER BY sort_order ASC, id ASC';
    const [rows] = await pool.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/',     (req, res) => res.status(501).json({ success: false, message: 'TODO: POST /banners' }));
router.put('/:id',   (req, res) => res.status(501).json({ success: false, message: 'TODO: PUT /banners/:id' }));
router.delete('/:id',(req, res) => res.status(501).json({ success: false, message: 'TODO: DELETE /banners/:id' }));

module.exports = router;
