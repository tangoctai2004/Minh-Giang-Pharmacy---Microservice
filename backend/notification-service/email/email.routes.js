const router = require('express').Router();
const pool = require('../db/pool');
const renderTemplate = require('../templates/renderTemplate');
const sendEmail = require('./emailProvider');
const {
  createNotificationLog,
  markNotificationSent,
  markNotificationFailed,
} = require('../notifications/logNotification');

router.post('/send', async (req, res) => {
  const {
    to,
    subject,
    html,
    text,
    template_id,
    template_vars,
    recipient_type,
    recipient_id,
    reference_type,
    reference_id,
  } = req.body;

  if (!to) {
    return res.status(400).json({ success: false, message: 'Thieu truong "to"' });
  }

  let notificationId = null;

  try {
    let mailHtml = html;
    let mailText = text;
    let mailSubject = subject;
    const vars = template_vars || {};

    if (template_id) {
      const [[tmpl]] = await pool.query(
        `SELECT id, subject, body_template
           FROM notification_templates
          WHERE id = ? AND channel = 'email' AND is_active = 1`,
        [template_id]
      );

      if (!tmpl) {
        return res.status(404).json({
          success: false,
          message: 'Template khong ton tai hoac da bi vo hieu hoa',
        });
      }

      mailSubject = renderTemplate(tmpl.subject || subject || 'Thong bao tu Minh Giang Pharmacy', vars);
      mailHtml = renderTemplate(tmpl.body_template, vars);

      notificationId = await createNotificationLog({
        templateId: template_id,
        recipientType: recipient_type,
        recipientId: recipient_id,
        channel: 'email',
        referenceType: reference_type,
        referenceId: reference_id,
        payload: {
          target: to,
          template_vars: vars,
          provider: process.env.EMAIL_PROVIDER || 'smtp',
        },
      });
    }

    if (!mailSubject) {
      return res.status(400).json({ success: false, message: 'Thieu truong "subject"' });
    }

    if (!mailHtml && !mailText) {
      return res.status(400).json({ success: false, message: 'Thieu noi dung html hoac text' });
    }

    const providerResult = await sendEmail({
      to,
      subject: mailSubject,
      html: mailHtml,
      text: mailText,
    });

    await markNotificationSent(notificationId, providerResult);

    res.json({
      success: true,
      message: 'Email da gui thanh cong',
      data: {
        provider: providerResult.provider,
        messageId: providerResult.provider_message_id,
        notificationId,
      },
    });
  } catch (err) {
    await markNotificationFailed(notificationId, err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
