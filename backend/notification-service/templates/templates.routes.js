const router = require('express').Router();
const pool   = require('../db/pool');

// GET /templates — Danh sách tất cả template
router.get('/', async (req, res) => {
  try {
    const { type } = req.query; // ?type=email|sms
    let sql = 'SELECT id, name, type, subject_template, is_active, created_at FROM notification_templates';
    const params = [];
    if (type) { sql += ' WHERE type = ?'; params.push(type); }
    sql += ' ORDER BY type, name';
    const [rows] = await pool.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /templates/:id — Chi tiết template (bao gồm body)
router.get('/:id', async (req, res) => {
  try {
    const [[row]] = await pool.query(
      'SELECT * FROM notification_templates WHERE id = ?',
      [req.params.id]
    );
    if (!row) return res.status(404).json({ success: false, message: 'Template không tìm thấy' });
    res.json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /templates — Tạo template mới
router.post('/', async (req, res) => {
  // TODO:
  // 1. Validate: name (unique), type in ['email','sms'], body_template required
  // 2. INSERT INTO notification_templates (name, type, subject_template, body_template, is_active) VALUES (?)
  // 3. Trả về 201 với id vừa tạo
  res.status(501).json({ success: false, message: 'TODO: POST /templates' });
});

// PUT /templates/:id — Cập nhật template
router.put('/:id', async (req, res) => {
  // TODO:
  // 1. Kiểm tra template tồn tại
  // 2. Validate fields tương tự POST
  // 3. UPDATE notification_templates SET ... WHERE id = ?
  res.status(501).json({ success: false, message: 'TODO: PUT /templates/:id' });
});

// DELETE /templates/:id — Xoá mềm (set is_active=0) hoặc xoá hẳn
router.delete('/:id', async (req, res) => {
  // TODO:
  // 1. Kiểm tra template tồn tại
  // 2. UPDATE notification_templates SET is_active = 0 WHERE id = ?  (soft delete)
  //    hoặc DELETE FROM notification_templates WHERE id = ?           (hard delete)
  res.status(501).json({ success: false, message: 'TODO: DELETE /templates/:id' });
});

module.exports = router;
