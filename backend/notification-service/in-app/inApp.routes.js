const router = require('express').Router();
const pool = require('../db/pool');
const renderTemplate = require('../templates/renderTemplate');
const requireRole = require('../middlewares/requireRole');

async function findInAppTemplate(templateId) {
  if (templateId) {
    const [[template]] = await pool.query(
      `SELECT id, subject, body_template
         FROM notification_templates
        WHERE id = ? AND channel = 'in_app' AND is_active = 1`,
      [templateId]
    );
    return template;
  }

  const [[template]] = await pool.query(
    `SELECT id, subject, body_template
       FROM notification_templates
      WHERE name = 'in_app_general' AND channel = 'in_app' AND is_active = 1`
  );
  return template;
}

router.post('/send', requireRole(['admin', 'pharmacist']), async (req, res) => {
  try {
    const {
      template_id,
      template_vars,
      recipient_type,
      recipient_id,
      title,
      body,
      reference_type,
      reference_id,
    } = req.body;

    if (!recipient_type || recipient_id == null) {
      return res.status(400).json({ success: false, message: 'Thieu recipient_type hoac recipient_id' });
    }

    const template = await findInAppTemplate(template_id);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Khong tim thay in-app template. Hay goi POST /templates/seed-defaults truoc',
      });
    }

    const vars = {
      title: title || 'Thong bao',
      body: body || '',
      ...(template_vars || {}),
    };

    const renderedTitle = renderTemplate(template.subject || '{{title}}', vars);
    const renderedBody = renderTemplate(template.body_template, vars);

    const [result] = await pool.query(
      `INSERT INTO notifications
         (template_id, recipient_type, recipient_id, channel, reference_type, reference_id, payload, status, sent_at)
       VALUES (?, ?, ?, 'in_app', ?, ?, ?, 'sent', NOW())`,
      [
        template.id,
        recipient_type,
        recipient_id,
        reference_type || null,
        reference_id || null,
        JSON.stringify({
          title: renderedTitle,
          body: renderedBody,
          template_vars: vars,
          read_at: null,
        }),
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Tao in-app notification thanh cong',
      data: { id: result.insertId },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/mine', async (req, res) => {
  try {
    const recipientType = req.query.recipient_type || req.userType || 'customer';
    const recipientId = req.query.recipient_id || req.userId;

    if (!recipientId) {
      return res.status(400).json({ success: false, message: 'Thieu recipient_id' });
    }

    const unreadOnly = req.query.unread_only === 'true';
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    let where = `WHERE channel = 'in_app' AND recipient_type = ? AND recipient_id = ?`;
    const params = [recipientType, recipientId];

    if (unreadOnly) {
      where += ` AND (JSON_EXTRACT(payload, '$.read_at') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.read_at')) = 'NULL')`;
    }

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM notifications ${where}`,
      params
    );

    const [rows] = await pool.query(
      `SELECT id, recipient_type, recipient_id, reference_type, reference_id, payload, status, sent_at, created_at
         FROM notifications
         ${where}
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: rows,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id/read', async (req, res) => {
  try {
    const [[notification]] = await pool.query(
      `SELECT id, channel FROM notifications WHERE id = ?`,
      [req.params.id]
    );

    if (!notification || notification.channel !== 'in_app') {
      return res.status(404).json({ success: false, message: 'Khong tim thay in-app notification' });
    }

    await pool.query(
      `UPDATE notifications
          SET payload = JSON_MERGE_PATCH(payload, ?)
        WHERE id = ?`,
      [JSON.stringify({ read_at: new Date().toISOString() }), req.params.id]
    );

    res.json({ success: true, message: 'Da danh dau da doc' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
