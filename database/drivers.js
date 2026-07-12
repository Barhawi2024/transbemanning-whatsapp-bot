const { query } = require('./connection');

async function createDriver(
  driverId,
  name,
  phone = null,
  vehicleNumber = null
) {
  const result = await query(
    `
      INSERT INTO drivers (
        driver_id,
        name,
        phone,
        vehicle_number,
        is_active,
        updated_at
      )
      VALUES ($1, $2, $3, $4, TRUE, NOW())

      ON CONFLICT (driver_id)
      DO UPDATE SET
        name = EXCLUDED.name,
        phone = EXCLUDED.phone,
        vehicle_number = EXCLUDED.vehicle_number,
        is_active = TRUE,
        updated_at = NOW()

      RETURNING *
    `,
    [driverId, name, phone, vehicleNumber]
  );

  return result.rows[0];
}

async function getDriver(driverId) {
  const result = await query(
    `
      SELECT *
      FROM drivers
      WHERE driver_id = $1
      LIMIT 1
    `,
    [driverId]
  );

  return result.rows[0] || null;
}

async function getDriverByPhone(phone) {
  const result = await query(
    `
      SELECT *
      FROM drivers
      WHERE RIGHT(
        REGEXP_REPLACE(phone, '[^0-9]', '', 'g'),
        9
      ) = RIGHT(
        REGEXP_REPLACE($1, '[^0-9]', '', 'g'),
        9
      )
      AND is_active = TRUE
      LIMIT 1
    `,
    [phone]
  );

  return result.rows[0] || null;
}

async function getAllDrivers() {
  const result = await query(
    `
      SELECT *
      FROM drivers
      WHERE is_active = TRUE
      ORDER BY name NULLS LAST, driver_id
    `
  );

  return result.rows;
}

async function updateDriverVehicle(driverId, vehicleNumber) {
  const result = await query(
    `
      UPDATE drivers
      SET
        vehicle_number = $1,
        updated_at = NOW()
      WHERE driver_id = $2
      RETURNING *
    `,
    [vehicleNumber, driverId]
  );

  return result.rows[0] || null;
}

async function deactivateDriver(driverId) {
  const result = await query(
    `
      UPDATE drivers
      SET
        is_active = FALSE,
        updated_at = NOW()
      WHERE driver_id = $1
      RETURNING *
    `,
    [driverId]
  );

  return result.rows[0] || null;
}

module.exports = {
  createDriver,
  getDriver,
  getDriverByPhone,
  getAllDrivers,
  updateDriverVehicle,
  deactivateDriver
};
