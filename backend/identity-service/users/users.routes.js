const router = require('express').Router();
const pool   = require('../db/pool');

/**
 * Users Routes — mg_identity.users (tài khoản nhân viên / admin)
 * Chỉ admin mới có quyền quản lý users
 *
 * GET    /users          — Danh sách nhân viên ✅
 * GET    /users/:id      — Chi tiết 1 nhân viên ✅
 * POST   /users          — Tạo tài khoản nhân viên (TODO)
 * PUT    /users/:id      — Cập nhật thông tin (TODO)
 * DELETE /users/:id      — Vô hiệu hoá tài khoản, soft-delete (TODO)
 */

// GET /users — Lấy danh sách nhân viên
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.code, u.full_name, u.email, u.phone,
              r.name AS role_name, u.is_active, u.created_at
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       ORDER BY u.id DESC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /users/:id
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.code, u.full_name, u.email, u.phone,
              r.name AS role_name, u.is_active, u.created_at
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Không tìm thấy nhân viên' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /users — Tạo tài khoản nhân viên
router.post('/', async (req, res) => {
  // TODO: 1. Validate { code, full_name, email, phone, password, role_id }
  //       2. Kiểm tra email/phone chưa trùng
  //       3. Hash password với bcrypt.hash(password, 10)
  //       4. INSERT INTO users (code, full_name, email, phone, password_hash, role_id)
  //       5. Trả về user mới (không có password_hash)
  res.status(501).json({ success: false, message: 'TODO: implement POST /users' });
});

// PUT /users/:id
router.put('/:id', async (req, res) => {
  // TODO: Validate rồi UPDATE users SET ... WHERE id = ?
  //       Nếu đổi password thì hash lại
  res.status(501).json({ success: false, message: 'TODO: implement PUT /users/:id' });
});

// DELETE /users/:id — Soft delete
router.delete('/:id', async (req, res) => {
  // TODO: UPDATE users SET is_active = 0 WHERE id = ?
  //       KHÔNG xoá vật lý (vì shift và order history cần giữ lại)
  res.status(501).json({ success: false, message: 'TODO: implement DELETE /users/:id' });
});

module.exports = router;
