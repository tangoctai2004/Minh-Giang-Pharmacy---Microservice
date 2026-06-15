const router = require('express').Router();
const pool = require('../db/pool');
const requireRole = require('../middlewares/requireRole');
const seedDefaultTemplates = require('./seedTemplates');

const CHANNELS = ['email', 'sms', 'push', 'in_app', 'zalo'];

function normalizeTemplateInput(body) {
  const isActive = body.is_active == null || body.is_active === ''
    ? 1
    : Number(body.is_active === true || body.is_active === 1 || body.is_active === '1');

  return {
    name: String(body.name || '').trim(),
    channel: String(body.channel || body.type || 'email').trim(),
    subject: body.subject == null ? null : String(body.subject).trim(),
    body_template: String(body.body_template || body.body || '').trim(),
    is_active: isActive,
  };
}

function validateTemplate(input) {
  if (!input.name) return 'Thieu truong "name"';
  if (input.name.length > 100) return 'Truong "name" toi da 100 ky tu';
  if (!CHANNELS.includes(input.channel)) return 'Kenh thong bao khong hop le';
  if (!input.body_template) return 'Thieu truong "body_template"';
  if (input.channel === 'email' && !input.subject) return 'Email template can co "subject"';
  return null;
}

router.get('/', requireRole(['admin', 'pharmacist']), async (req, res) => {
  try {
    const channel = req.query.channel || req.query.type;
    const includeInactive = req.query.include_inactive === 'true';

    let sql = 'SELECT id, name, channel, subject, is_active FROM notification_templates';
    const where = [];
    const params = [];

    if (channel) {
      if (!CHANNELS.includes(channel)) {
        return res.status(400).json({ success: false, message: 'Kenh thong bao khong hop le' });
      }
      where.push('channel = ?');
      params.push(channel);
    }

    if (!includeInactive) {
      where.push('is_active = 1');
    }

    if (where.length) sql += ` WHERE ${where.join(' AND ')}`;
    sql += ' ORDER BY channel, name';

    const [rows] = await pool.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/seed-defaults', requireRole(['admin', 'pharmacist']), async (req, res) => {
  try {
    const count = await seedDefaultTemplates();
    res.json({
      success: true,
      message: 'Seed template mac dinh thanh cong',
      data: { count },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id', requireRole(['admin', 'pharmacist']), async (req, res) => {
  try {
    const [[row]] = await pool.query(
      'SELECT * FROM notification_templates WHERE id = ?',
      [req.params.id]
    );

    if (!row) {
      return res.status(404).json({ success: false, message: 'Khong tim thay template' });
    }

    res.json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', requireRole(['admin', 'pharmacist']), async (req, res) => {
  try {
    const input = normalizeTemplateInput(req.body);
    const validationError = validateTemplate(input);
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    const [[existing]] = await pool.query(
      'SELECT id FROM notification_templates WHERE name = ? AND channel = ?',
      [input.name, input.channel]
    );

    if (existing) {
      return res.status(409).json({ success: false, message: 'Template da ton tai cho kenh nay' });
    }

    const [result] = await pool.query(
      `INSERT INTO notification_templates
         (name, channel, subject, body_template, is_active)
       VALUES (?, ?, ?, ?, ?)`,
      [input.name, input.channel, input.subject, input.body_template, input.is_active]
    );

    res.status(201).json({
      success: true,
      data: { id: result.insertId },
      message: 'Tao template thanh cong',
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', requireRole(['admin', 'pharmacist']), async (req, res) => {
  try {
    const [[current]] = await pool.query(
      'SELECT * FROM notification_templates WHERE id = ?',
      [req.params.id]
    );

    if (!current) {
      return res.status(404).json({ success: false, message: 'Khong tim thay template' });
    }

    const input = normalizeTemplateInput({
      ...current,
      ...req.body,
    });
    const validationError = validateTemplate(input);
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    const [[duplicate]] = await pool.query(
      'SELECT id FROM notification_templates WHERE name = ? AND channel = ? AND id <> ?',
      [input.name, input.channel, req.params.id]
    );

    if (duplicate) {
      return res.status(409).json({ success: false, message: 'Template da ton tai cho kenh nay' });
    }

    await pool.query(
      `UPDATE notification_templates
          SET name = ?, channel = ?, subject = ?, body_template = ?, is_active = ?
        WHERE id = ?`,
      [input.name, input.channel, input.subject, input.body_template, input.is_active, req.params.id]
    );

    res.json({ success: true, message: 'Cap nhat template thanh cong' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', requireRole(['admin', 'pharmacist']), async (req, res) => {
  try {
    const [[current]] = await pool.query(
      'SELECT id FROM notification_templates WHERE id = ?',
      [req.params.id]
    );

    if (!current) {
      return res.status(404).json({ success: false, message: 'Khong tim thay template' });
    }

    await pool.query(
      'UPDATE notification_templates SET is_active = 0 WHERE id = ?',
      [req.params.id]
    );

    res.json({ success: true, message: 'Xoa template thanh cong' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
