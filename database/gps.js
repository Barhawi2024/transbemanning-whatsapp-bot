const { query } = require('./connection');

async function saveGpsLocation({
  driverId = null,
  sender,
  latitude,
  longitude,
  accuracy = null,
  address = null,
  capturedAt = new Date(),
  metadata = null
}) {
  const lat = Number(latitude);
  const lng = Number(longitude);

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new Error('Ogiltig latitude');
  }

  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new Error('Ogiltig longitude');
  }

  const result = await query(
    `
      INSERT INTO gps_locations (
        driver_id,
        sender,
        latitude,
        longitude,
        accuracy,
        address,
        captured_at,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
    [
      driverId,
      sender,
      lat,
      lng,
      accuracy,
      address,
      capturedAt,
      metadata ? JSON.stringify(metadata) : null
    ]
  );

  return result.rows[0];
}

async function getLatestGpsLocation({
  driverId = null,
  sender = null
} = {}) {
  if (!driverId && !sender) {
    throw new Error('driverId eller sender krävs');
  }

  const result = await query(
    `
      SELECT *
      FROM gps_locations
      WHERE
        ($1::VARCHAR IS NULL OR driver_id = $1)
        AND ($2::VARCHAR IS NULL OR sender = $2)
      ORDER BY captured_at DESC
      LIMIT 1
    `,
    [driverId, sender]
  );

  return result.rows[0] || null;
}

async function getGpsHistory({
  driverId = null,
  sender = null,
  from = null,
  to = null,
  limit = 500
} = {}) {
  const values = [];
  const where = [];

  if (driverId) {
    values.push(driverId);
    where.push(`driver_id = $${values.length}`);
  }

  if (sender) {
    values.push(sender);
    where.push(`sender = $${values.length}`);
  }

  if (from) {
    values.push(from);
    where.push(`captured_at >= $${values.length}`);
  }

  if (to) {
    values.push(to);
    where.push(`captured_at < $${values.length}`);
  }

  values.push(limit);

  const result = await query(
    `
      SELECT *
      FROM gps_locations
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY captured_at DESC
      LIMIT $${values.length}
    `,
    values
  );

  return result.rows;
}

module.exports = {
  saveGpsLocation,
  getLatestGpsLocation,
  getGpsHistory
};
