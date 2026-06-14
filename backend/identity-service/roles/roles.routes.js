const router = require('express').Router();
const pool   = require('../db/pool');
const { requirePermission } = require('../middlewares/rbac');

const canManageRoles = requirePermission('users.manage', 'Không có quyền quản lý vai trò');

function requireAdmin(req, res) {
  return canManageRoles(req, res);
  if (!req.userId) {
    res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
    return false;
  }
  if (req.userRole !== 'admin' && !req.userPermissions.includes('users.manage')) {
    res.status(403).json({ success: false, message: 'Không có quyền quản lý vai trò' });
    return false;
  }
  return true;
}

function normalizePermissions(value) {
  if (value === undefined) return [];
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) return value;
  return null;
}

// GET /roles — Danh sách vai trò
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name, description, permissions FROM roles ORDER BY id');
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

router.post('/', async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const { name, description } = req.body;
    const permissions = normalizePermissions(req.body.permissions);
    if (!name || permissions === null) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp name và permissions dạng mảng chuỗi' });
    }

    const [result] = await pool.query(
      'INSERT INTO roles (name, description, permissions) VALUES (?, ?, ?)',
      [name, description || null, JSON.stringify(permissions)]
    );
    const [[role]] = await pool.query('SELECT * FROM roles WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: role });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Tên vai trò đã tồn tại' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const { name, description } = req.body;
    const permissions = normalizePermissions(req.body.permissions);
    if (!name || permissions === null) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp name và permissions dạng mảng chuỗi' });
    }

    const [result] = await pool.query(
      'UPDATE roles SET name = ?, description = ?, permissions = ? WHERE id = ?',
      [name, description || null, JSON.stringify(permissions), req.params.id]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy vai trò' });
    }
    const [[role]] = await pool.query('SELECT * FROM roles WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: role });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Tên vai trò đã tồn tại' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const [[inUse]] = await pool.query('SELECT id FROM users WHERE role_id = ? LIMIT 1', [req.params.id]);
    if (inUse) {
      return res.status(409).json({ success: false, message: 'Vai trò đang được gán cho nhân viên, không thể xóa' });
    }

    const [result] = await pool.query('DELETE FROM roles WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy vai trò' });
    }
    res.json({ success: true, message: 'Xóa vai trò thành công' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
