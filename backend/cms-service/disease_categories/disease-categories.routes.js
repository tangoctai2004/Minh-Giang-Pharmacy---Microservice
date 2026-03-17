const router = require('express').Router();
const pool   = require('../db/pool');

// GET /disease-categories (public)
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, slug, parent_id, description, image_url
       FROM disease_categories WHERE is_active = 1 ORDER BY sort_order, name`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/',     (req, res) => res.status(501).json({ success: false, message: 'TODO: POST /disease-categories' }));
router.put('/:id',   (req, res) => res.status(501).json({ success: false, message: 'TODO: PUT /disease-categories/:id' }));
router.delete('/:id',(req, res) => res.status(501).json({ success: false, message: 'TODO: DELETE /disease-categories/:id' }));

module.exports = router;
