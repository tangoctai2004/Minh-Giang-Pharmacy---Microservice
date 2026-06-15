const pool = require('../db/pool');
const sendEmail = require('../email/emailProvider');
const { sendSms } = require('../sms/smsProvider');
const renderTemplate = require('../templates/renderTemplate');
const {
  markNotificationSent,
  markNotificationFailed,
} = require('./logNotification');

function parsePayload(payload) {
  if (!payload) return {};
  if (typeof payload === 'object') return payload;

  try {
    return JSON.parse(payload);
  } catch (_err) {
    return {};
  }
}

async function retryNotification(id) {
  const [[notification]] = await pool.query(
    `SELECT n.*, t.subject, t.body_template
       FROM notifications n
       JOIN notification_templates t ON t.id = n.template_id
      WHERE n.id = ?`,
    [id]
  );

  if (!notification) {
    const err = new Error('Khong tim thay thong bao');
    err.status = 404;
    throw err;
  }

  if (notification.status !== 'failed') {
    const err = new Error('Chi retry thong bao dang o trang thai failed');
    err.status = 400;
    throw err;
  }

  const payload = parsePayload(notification.payload);
  const target = payload.target;
  const templateVars = payload.template_vars || {};

  if (!target) {
    const err = new Error('Notification payload thieu target de retry');
    err.status = 400;
    throw err;
  }

  await pool.query(
    `UPDATE notifications
        SET status = 'pending',
            payload = JSON_MERGE_PATCH(payload, ?)
      WHERE id = ?`,
    [JSON.stringify({ retry_at: new Date().toISOString(), error: null }), id]
  );

  try {
    const body = renderTemplate(notification.body_template, templateVars);
    let providerResult;

    if (notification.channel === 'email') {
      providerResult = await sendEmail({
        to: target,
        subject: renderTemplate(notification.subject || 'Thong bao Minh Giang Pharmacy', templateVars),
        html: body,
        text: body.replace(/<[^>]+>/g, ''),
      });
    } else if (notification.channel === 'sms') {
      providerResult = await sendSms({ phone: target, message: body });
    } else {
      const err = new Error(`Kenh ${notification.channel} chua ho tro retry tu dong`);
      err.status = 400;
      throw err;
    }

    await markNotificationSent(id, {
      ...providerResult,
      retry_success_at: new Date().toISOString(),
    });

    return {
      id: Number(id),
      status: 'sent',
      provider: providerResult.provider,
      providerMessageId: providerResult.provider_message_id,
    };
  } catch (err) {
    await markNotificationFailed(id, err);
    throw err;
  }
}

module.exports = retryNotification;
