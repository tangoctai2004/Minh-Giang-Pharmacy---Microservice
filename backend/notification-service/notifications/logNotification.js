const pool = require('../db/pool');

async function createNotificationLog({
  templateId,
  recipientType,
  recipientId,
  channel,
  referenceType,
  referenceId,
  payload,
}) {
  if (!templateId || !recipientType || recipientId == null) {
    return null;
  }

  const [result] = await pool.query(
    `INSERT INTO notifications
       (template_id, recipient_type, recipient_id, channel, reference_type, reference_id, payload, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      templateId,
      recipientType,
      recipientId,
      channel,
      referenceType || null,
      referenceId || null,
      JSON.stringify(payload || {}),
    ]
  );

  return result.insertId;
}

async function markNotificationSent(id, providerPayload = {}) {
  if (!id) return;

  await pool.query(
    `UPDATE notifications
        SET status = 'sent',
            sent_at = NOW(),
            payload = JSON_MERGE_PATCH(payload, ?)
      WHERE id = ?`,
    [JSON.stringify(providerPayload), id]
  );
}

async function markNotificationFailed(id, error) {
  if (!id) return;

  await pool.query(
    `UPDATE notifications
        SET status = 'failed',
            payload = JSON_MERGE_PATCH(payload, ?)
      WHERE id = ?`,
    [JSON.stringify({ error: error.message || String(error) }), id]
  );
}

module.exports = {
  createNotificationLog,
  markNotificationSent,
  markNotificationFailed,
};
