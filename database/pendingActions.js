const { query } = require('./connection');

async function setPendingAction({
  sender,
  driverId = null,
  action,
  metadata = null
}) {
  const result = await query(
    `
      INSERT INTO pending_actions (
        sender,
        driver_id,
        action,
        metadata,
        updated_at
      )
      VALUES ($1, $2, $3, $4::jsonb, NOW())
      ON CONFLICT (sender)
      DO UPDATE SET
        driver_id = EXCLUDED.driver_id,
        action = EXCLUDED.action,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
      RETURNING *
    `,
    [
      sender,
      driverId,
      action,
      metadata ? JSON.stringify(metadata) : null
    ]
  );

  return result.rows[0];
}

async function getPendingAction(sender) {
  const result = await query(
    `
      SELECT *
      FROM pending_actions
      WHERE sender = $1
      LIMIT 1
    `,
    [sender]
  );

  return result.rows[0] || null;
}

async function clearPendingAction(sender) {
  await query(
    `
      DELETE FROM pending_actions
      WHERE sender = $1
    `,
    [sender]
  );

  return true;
}

module.exports = {
  setPendingAction,
  getPendingAction,
  clearPendingAction
};
