const router = require('express').Router();
const pool   = require('../db/pool');

/**
 * Products Routes — mg_catalog.products
 * GET /products và GET /products/:id là PUBLIC (gateway whitelist)
 */

// GET /products — Danh sách sản phẩm với phân trang
router.get('/', async (req, res) => {
  try {
    const page     = Math.max(1, Number(req.query.page)  || 1);
    const limit    = Math.min(100, Number(req.query.limit) || 20);
    const offset   = (page - 1) * limit;
    const keyword  = req.query.q ? `%${req.query.q}%` : null;
    const categoryId = req.query.category_id ? Number(req.query.category_id) : null;

    let where = 'WHERE p.is_active = 1';
    const params = [];
    if (keyword)    { where += ' AND (p.name LIKE ? OR p.code LIKE ?)'; params.push(keyword, keyword); }
    if (categoryId) { where += ' AND p.category_id = ?'; params.push(categoryId); }

    const [rows] = await pool.query(
      `SELECT p.id, p.code, p.name, p.slug, p.retail_price, p.unit,
              p.base_unit, p.requires_prescription, p.is_active,
              c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       ${where}
       ORDER BY p.id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM products p ${where}`, params
    );
    res.json({ success: true, data: rows, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /products/:id
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.*, c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/',     (req, res) => res.status(501).json({ success: false, message: 'TODO: POST /products' }));
router.put('/:id',   (req, res) => res.status(501).json({ success: false, message: 'TODO: PUT /products/:id' }));
router.delete('/:id',(req, res) => res.status(501).json({ success: false, message: 'TODO: DELETE /products/:id — soft delete (SET is_active=0)' }));

module.exports = router;
