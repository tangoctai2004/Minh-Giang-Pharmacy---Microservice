const router = require('express').Router();
const pool = require('../db/pool');
const renderTemplate = require('../templates/renderTemplate');
const { normalizePhone, sendSms } = require('./smsProvider');
const {
  createNotificationLog,
  markNotificationSent,
  markNotificationFailed,
} = require('../notifications/logNotification');

router.post('/send', async (req, res) => {
  const {
    message,
    template_id,
    template_vars,
    recipient_type,
    recipient_id,
    reference_type,
    reference_id,
  } = req.body;
  const phone = normalizePhone(req.body.phone);

  if (!phone) {
    return res.status(400).json({ success: false, message: 'Thieu truong "phone"' });
  }

  let notificationId = null;

  try {
    let smsMessage = message;
    const vars = template_vars || {};

    if (template_id) {
      const [[tmpl]] = await pool.query(
        `SELECT id, body_template
           FROM notification_templates
          WHERE id = ? AND channel IN ('sms', 'zalo') AND is_active = 1`,
        [template_id]
      );

      if (!tmpl) {
        return res.status(404).json({
          success: false,
          message: 'Template khong ton tai hoac da bi vo hieu hoa',
        });
      }

      smsMessage = renderTemplate(tmpl.body_template, vars);

      notificationId = await createNotificationLog({
        templateId: template_id,
        recipientType: recipient_type,
        recipientId: recipient_id,
        channel: 'sms',
        referenceType: reference_type,
        referenceId: reference_id,
        payload: {
          target: phone,
          template_vars: vars,
          provider: process.env.SMS_PROVIDER || null,
        },
      });
    }

    if (!smsMessage) {
      return res.status(400).json({ success: false, message: 'Thieu truong "message"' });
    }

    const providerResult = await sendSms({ phone, message: smsMessage });
    await markNotificationSent(notificationId, providerResult);

    res.json({
      success: true,
      message: 'SMS da gui thanh cong',
      data: {
        provider: providerResult.provider,
        providerMessageId: providerResult.provider_message_id,
        notificationId,
      },
    });
  } catch (err) {
    await markNotificationFailed(notificationId, err);
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

module.exports = router;
