const { query } = require('./connection');

async function saveCommand({
  sender,
  driverId = null,
  command,
  commandText = null,
  status = 'received',
  resultText = null,
  metadata = null
}) {
  const result = await query(
    `
      INSERT INTO commands (
        sender,
        driver_id,
        command,
        command_text,
        status,
        result_text,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `,
    [
      sender,
      driverId,
      String(command || '').toUpperCase(),
      commandText,
      status,
      resultText,
      metadata ? JSON.stringify(metadata) : null
    ]
  );

  return result.rows[0];
}

async function updateCommandResult(
  id,
  {
    status = 'completed',
    resultText = null,
    metadata = null
  } = {}
) {
  const result = await query(
    `
      UPDATE commands
      SET
        status = $1,
        result_text = $2,
        metadata = COALESCE($3, metadata),
        completed_at = NOW()
      WHERE id = $4
      RETURNING *
    `,
    [
      status,
      resultText,
      metadata ? JSON.stringify(metadata) : null,
      id
    ]
  );

  return result.rows[0] || null;
}

async function listCommands({
  sender = null,
  driverId = null,
  command = null,
  from = null,
  to = null,
  limit = 500
} = {}) {
  const values = [];
  const where = [];

  if (sender) {
    values.push(sender);
    where.push(`sender = $${values.length}`);
  }

  if (driverId) {
    values.push(driverId);
    where.push(`driver_id = $${values.length}`);
  }

  if (command) {
    values.push(String(command).toUpperCase());
    where.push(`command = $${values.length}`);
  }

  if (from) {
    values.push(from);
    where.push(`created_at >= $${values.length}`);
  }

  if (to) {
    values.push(to);
    where.push(`created_at < $${values.length}`);
  }

  values.push(limit);

  const result = await query(
    `
      SELECT *
      FROM commands
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY created_at DESC
      LIMIT $${values.length}
    `,
    values
  );

  return result.rows;
}

module.exports = {
  saveCommand,
  updateCommandResult,
  listCommands
};
