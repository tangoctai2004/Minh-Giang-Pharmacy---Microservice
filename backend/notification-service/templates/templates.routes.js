const router = require('express').Router();
const pool   = require('../db/pool');

// GET /templates — Danh sách tất cả template
router.get('/', async (req, res) => {
  try {
    const { channel } = req.query; // ?channel=email|sms|push|in_app|zalo
    let sql = 'SELECT id, name, channel, subject, is_active FROM notification_templates';
    const params = [];
    if (channel) { sql += ' WHERE channel = ?'; params.push(channel); }
    sql += ' ORDER BY channel, name';
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
  try {
    const { name, channel = 'email', subject = null, body_template, is_active = 1 } = req.body;
    if (!name || !body_template) {
      return res.status(400).json({ success: false, message: 'Thiếu name hoặc body_template' });
    }
    if (!['email', 'sms', 'push', 'in_app', 'zalo'].includes(channel)) {
      return res.status(400).json({ success: false, message: 'channel không hợp lệ' });
    }

    const [result] = await pool.query(
      `INSERT INTO notification_templates (name, channel, subject, body_template, is_active)
       VALUES (?, ?, ?, ?, ?)`,
      [name, channel, subject, body_template, is_active ? 1 : 0]
    );
    res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Template name/channel đã tồn tại' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /templates/:id — Cập nhật template
router.put('/:id', async (req, res) => {
  try {
    const allowed = ['name', 'channel', 'subject', 'body_template', 'is_active'];
    const fields = [];
    const params = [];

    if (req.body.channel && !['email', 'sms', 'push', 'in_app', 'zalo'].includes(req.body.channel)) {
      return res.status(400).json({ success: false, message: 'channel không hợp lệ' });
    }

    for (const field of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        fields.push(`${field} = ?`);
        params.push(field === 'is_active' ? (req.body[field] ? 1 : 0) : req.body[field]);
      }
    }

    if (!fields.length) {
      return res.status(400).json({ success: false, message: 'Không có trường để cập nhật' });
    }

    params.push(req.params.id);
    const [result] = await pool.query(
      `UPDATE notification_templates SET ${fields.join(', ')} WHERE id = ?`,
      params
    );
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'Template không tìm thấy' });
    }
    res.json({ success: true, message: 'Đã cập nhật template' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Template name/channel đã tồn tại' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /templates/:id — Xoá mềm (set is_active=0) hoặc xoá hẳn
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await pool.query(
      'UPDATE notification_templates SET is_active = 0 WHERE id = ?',
      [req.params.id]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'Template không tìm thấy' });
    }
    res.json({ success: true, message: 'Đã vô hiệu hoá template' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
