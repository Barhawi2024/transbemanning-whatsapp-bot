const { query } = require('./connection');

async function saveActivity({
  driverId = null,
  sender,
  action,
  commandText = null,
  vehicleNumber = null,
  metadata = null
}) {
  const result = await query(
    `
      INSERT INTO activities (
        driver_id,
        sender,
        action,
        command_text,
        vehicle_number,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `,
    [
      driverId,
      sender,
      action,
      commandText,
      vehicleNumber,
      metadata ? JSON.stringify(metadata) : null
    ]
  );

  return result.rows[0];
}

async function getActivitiesByDriver(driverId, limit = 100) {
  const result = await query(
    `
      SELECT *
      FROM activities
      WHERE driver_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [driverId, limit]
  );

  return result.rows;
}

async function getActivitiesBySender(sender, limit = 100) {
  const result = await query(
    `
      SELECT *
      FROM activities
      WHERE sender = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [sender, limit]
  );

  return result.rows;
}

async function getAllActivities(limit = 500) {
  const result = await query(
    `
      SELECT *
      FROM activities
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [limit]
  );

  return result.rows;
}

module.exports = {
  saveActivity,
  getActivitiesByDriver,
  getActivitiesBySender,
  getAllActivities
};
