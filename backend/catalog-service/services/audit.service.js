const pool = require('../db/pool');

async function writeAudit(input, conn = null) {
  const executor = conn || pool;
  const {
    action,
    entity_type,
    entity_id = null,
    user_id = null,
    request_id = null,
    before_data = null,
    after_data = null,
    metadata = null,
  } = input;

  await executor.query(
    `INSERT INTO catalog_audit_logs
      (action, entity_type, entity_id, user_id, request_id, before_data, after_data, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      action,
      entity_type,
      entity_id,
      user_id,
      request_id,
      before_data ? JSON.stringify(before_data) : null,
      after_data ? JSON.stringify(after_data) : null,
      metadata ? JSON.stringify(metadata) : null,
    ]
  );
}

module.exports = {
  writeAudit,
};
