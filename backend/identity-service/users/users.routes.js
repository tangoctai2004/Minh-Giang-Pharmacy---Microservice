const router = require('express').Router();
const pool   = require('../db/pool');
const bcrypt = require('bcryptjs');

/**
 * Users Routes — mg_identity.users (tài khoản nhân viên / admin)
 * Chỉ admin mới có quyền quản lý users
 *
 * GET    /users          — Danh sách nhân viên ✅
 * GET    /users/:id      — Chi tiết 1 nhân viên ✅
 * POST   /users          — Tạo tài khoản nhân viên ✅
 * PUT    /users/:id      — Cập nhật thông tin (TODO)
 * DELETE /users/:id      — Vô hiệu hoá tài khoản, soft-delete (TODO)
 */

// ── Helper: kiểm tra quyền admin ─────────────────────────────────────────────
function requireAdmin(req, res) {
  if (!req.userId) {
    res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
    return false;
  }
  if (req.userRole !== 'admin') {
    res.status(403).json({ success: false, message: 'Chỉ admin mới có quyền thực hiện' });
    return false;
  }
  return true;
}

// GET /users — Lấy danh sách nhân viên
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.username, u.full_name, u.email, u.phone,
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
      `SELECT u.id, u.username, u.full_name, u.email, u.phone,
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

// POST /users — Tạo tài khoản nhân viên dành cho admin
router.post('/', async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const { username, full_name, email, phone, password, role_id } = req.body;

    // 1. Validate input
    if (!username || !full_name || !email || !password || !role_id) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập đầy đủ: username, full_name, email, password, role_id',
      });
    }

    // 2. Kiểm tra username hoặc email đã tồn tại chưa
    const [[existing]] = await pool.query(
      'SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1',
      [username, email]
    );
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Username hoặc email đã tồn tại',
      });
    }

    // 3. Kiểm tra role_id hợp lệ
    const [[role]] = await pool.query('SELECT id, name FROM roles WHERE id = ?', [role_id]);
    if (!role) {
      return res.status(400).json({
        success: false,
        message: 'role_id không hợp lệ',
      });
    }

    // 4. Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // 5. Insert user mới
    const [result] = await pool.query(
      `INSERT INTO users (username, full_name, email, phone, password_hash, role_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [username, full_name, email, phone || null, passwordHash, role_id]
    );

    // 6. Trả kết quả
    res.status(201).json({
      success: true,
      data: {
        id:        result.insertId,
        username,
        full_name,
        email,
        phone:     phone || null,
        role_name: role.name,
        is_active: 1,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /users/:id
router.put('/:id', async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const { username, full_name, email, phone, password, role_id, is_active } = req.body;

    // 1. Validate input
    if (!username || !full_name || !email || !role_id) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập đầy đủ: username, full_name, email, role_id',
      });
    }

    // 2. Kiểm tra user tồn tại
    const [[existingUser]] = await pool.query('SELECT id FROM users WHERE id = ?', [req.params.id]);
    if (!existingUser) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nhân viên' });
    }

    // 3. Kiểm tra role_id hợp lệ
    const [[role]] = await pool.query('SELECT id, name FROM roles WHERE id = ?', [role_id]);
    if (!role) {
      return res.status(400).json({
        success: false,
        message: 'role_id không hợp lệ',
      });
    }

    // 4. Hash password nếu có
    let passwordHash = null;
    if (password) {
      passwordHash = await bcrypt.hash(password, 10);
    }

    // 5. Update user
    await pool.query(
      `UPDATE users
       SET username = ?, full_name = ?, email = ?, phone = ?, password_hash = COALESCE(?, password_hash), role_id = ?, is_active = ?
       WHERE id = ?`,
      [username, full_name, email, phone || null, passwordHash, role_id, is_active !== undefined ? is_active : 1, req.params.id]
    );

    // 6. Trả kết quả
    res.json({
      success: true,
      data: {
        id:        req.params.id,
        username,
        full_name,
        email,
        phone:     phone || null,
        role_name: role.name,
        is_active: is_active !== undefined ? is_active : 1,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /users/:id — Soft delete
router.delete('/:id', async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const userId = Number(req.params.id);

    // 1. Validate id
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'ID nhân viên không hợp lệ',
      });
    }

    // 2. Không cho admin tự khoá chính mình
    if (req.userId === userId) {
      return res.status(400).json({
        success: false,
        message: 'Không thể tự vô hiệu hoá tài khoản của chính mình',
      });
    }

    // 3. Kiểm tra user tồn tại
    const [[existingUser]] = await pool.query(
      'SELECT id, is_active FROM users WHERE id = ? LIMIT 1',
      [userId]
    );
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy nhân viên',
      });
    }

    // 4. Nếu đã bị khoá thì trả success idempotent
    if (!existingUser.is_active) {
      return res.json({
        success: true,
        message: 'Tài khoản đã ở trạng thái vô hiệu trước đó',
      });
    }

    // 5. Soft delete
    await pool.query(
      'UPDATE users SET is_active = 0 WHERE id = ?',
      [userId]
    );

    // 6. Trả kết quả
    res.json({
      success: true,
      message: 'Vô hiệu hoá tài khoản thành công',
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;