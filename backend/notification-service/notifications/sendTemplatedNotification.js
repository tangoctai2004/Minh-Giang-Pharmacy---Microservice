const pool = require('../db/pool');
const sendEmail = require('../email/emailProvider');
const { sendSms } = require('../sms/smsProvider');
const renderTemplate = require('../templates/renderTemplate');
const {
  createNotificationLog,
  markNotificationSent,
  markNotificationFailed,
} = require('./logNotification');

async function findTemplate(name, channel) {
  const [[template]] = await pool.query(
    `SELECT id, channel, subject, body_template
       FROM notification_templates
      WHERE name = ? AND channel = ? AND is_active = 1`,
    [name, channel]
  );
  return template;
}

async function sendTemplatedNotification({
  templateName,
  channel,
  target,
  templateVars,
  recipientType,
  recipientId,
  referenceType,
  referenceId,
}) {
  const template = await findTemplate(templateName, channel);
  if (!template) {
    const err = new Error(`Khong tim thay template ${templateName}/${channel}`);
    err.status = 404;
    throw err;
  }

  const notificationId = await createNotificationLog({
    templateId: template.id,
    recipientType,
    recipientId,
    channel,
    referenceType,
    referenceId,
    payload: {
      target,
      template_vars: templateVars || {},
      provider: channel === 'email' ? (process.env.EMAIL_PROVIDER || 'smtp') : (process.env.SMS_PROVIDER || null),
    },
  });

  try {
    const body = renderTemplate(template.body_template, templateVars);
    let providerResult;

    if (channel === 'email') {
      providerResult = await sendEmail({
        to: target,
        subject: renderTemplate(template.subject || 'Thong bao Minh Giang Pharmacy', templateVars),
        html: body,
        text: body.replace(/<[^>]+>/g, ''),
      });
    } else if (channel === 'sms') {
      providerResult = await sendSms({ phone: target, message: body });
    } else {
      const err = new Error(`Kenh ${channel} chua duoc ho tro gui tu dong`);
      err.status = 400;
      throw err;
    }

    await markNotificationSent(notificationId, providerResult);
    return {
      success: true,
      channel,
      target,
      notificationId,
      provider: providerResult.provider,
      providerMessageId: providerResult.provider_message_id,
    };
  } catch (err) {
    await markNotificationFailed(notificationId, err);
    throw err;
  }
}

module.exports = sendTemplatedNotification;
