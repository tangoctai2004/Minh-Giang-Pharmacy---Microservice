const router = require('express').Router();
const pool   = require('../db/pool');

/**
 * Customers Routes — mg_identity.customers (khách hàng)
 *
 * GET    /customers        — Danh sách khách (admin) ✅
 * GET    /customers/me     — Hồ sơ khách đang đăng nhập ✅
 * GET    /customers/:id    — Chi tiết 1 khách ✅
 * POST   /customers        — Admin thêm khách thủ công (TODO)
 * PUT    /customers/:id    — Cập nhật hồ sơ (TODO)
 * DELETE /customers/:id    — Xoá mềm — ĐẶT deleted_at, không DELETE vật lý (TODO)
 */

// GET /customers
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, code, full_name, phone, email, loyalty_points,
              is_active, created_at
       FROM customers
       WHERE deleted_at IS NULL
       ORDER BY id DESC
       LIMIT 100`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /customers/me — Hồ sơ khách đang đăng nhập
router.get('/me', async (req, res) => {
  if (!req.userId) {
    return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
  }
  try {
    const [rows] = await pool.query(
      `SELECT id, code, full_name, phone, email, date_of_birth,
              gender, loyalty_points, is_active, created_at
       FROM customers WHERE id = ? AND deleted_at IS NULL`,
      [req.userId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /customers/:id
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, code, full_name, phone, email, date_of_birth,
              gender, loyalty_points, is_active, created_at
       FROM customers WHERE id = ? AND deleted_at IS NULL`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Không tìm thấy khách hàng' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /customers
router.post('/', async (req, res) => {
  res.status(501).json({ success: false, message: 'TODO: implement POST /customers' });
});

// PUT /customers/:id
router.put('/:id', async (req, res) => {
  res.status(501).json({ success: false, message: 'TODO: implement PUT /customers/:id' });
});

// DELETE /customers/:id — Soft delete (D1-05 security requirement)
router.delete('/:id', async (req, res) => {
  // TODO: UPDATE customers SET deleted_at = NOW() WHERE id = ?
  //       KHÔNG dùng DELETE vật lý (vi phạm Nghị định 13/2023/NĐ-CP)
  res.status(501).json({ success: false, message: 'TODO: implement soft-delete customers — SET deleted_at = NOW()' });
});

module.exports = router;
