const pool = require('../db/pool');
const defaultTemplates = require('./defaultTemplates');

async function seedDefaultTemplates() {
  let insertedOrUpdated = 0;

  for (const template of defaultTemplates) {
    await pool.query(
      `INSERT INTO notification_templates
         (name, channel, subject, body_template, is_active)
       VALUES (?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE
         subject = VALUES(subject),
         body_template = VALUES(body_template),
         is_active = 1`,
      [template.name, template.channel, template.subject, template.body_template]
    );
    insertedOrUpdated += 1;
  }

  return insertedOrUpdated;
}

module.exports = seedDefaultTemplates;
