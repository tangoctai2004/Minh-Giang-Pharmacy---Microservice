const router = require('express').Router();
const pool   = require('../db/pool');

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
  try {
    const { name, description, permissions } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Vui lòng nhập tên vai trò' });
    
    const permsJson = JSON.stringify(permissions || []);
    const [result] = await pool.query(
      'INSERT INTO roles (name, description, permissions) VALUES (?, ?, ?)',
      [name, description || '', permsJson]
    );
    res.json({ success: true, data: { id: result.insertId, name, description, permissions: permissions || [] } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ success: false, message: 'Tên vai trò đã tồn tại' });
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, description, permissions } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Vui lòng nhập tên vai trò' });

    const permsJson = JSON.stringify(permissions || []);
    await pool.query(
      'UPDATE roles SET name = ?, description = ?, permissions = ? WHERE id = ?',
      [name, description || '', permsJson, req.params.id]
    );
    res.json({ success: true, message: 'Cập nhật vai trò thành công' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ success: false, message: 'Tên vai trò đã tồn tại' });
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    // Không cho phép xoá admin
    if (req.params.id == 1) {
      return res.status(400).json({ success: false, message: 'Không thể xoá vai trò Quản trị viên hệ thống' });
    }
    await pool.query('DELETE FROM roles WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Đã xoá vai trò thành công' });
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(400).json({ success: false, message: 'Không thể xoá vì đang có nhân viên gắn với vai trò này' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
