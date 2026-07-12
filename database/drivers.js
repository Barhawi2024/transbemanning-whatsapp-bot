const { pool } = require('./index');

async function createDriver(driverId, name, phone = null) {
  const result = await pool.query(
    `INSERT INTO drivers (driver_id, name, phone)
     VALUES ($1,$2,$3)
     ON CONFLICT (driver_id)
     DO UPDATE SET
       name = EXCLUDED.name,
       phone = EXCLUDED.phone
     RETURNING *`,
    [driverId, name, phone]
  );

  return result.rows[0];
}

async function getDriver(driverId) {
  const result = await pool.query(
    "SELECT * FROM drivers WHERE driver_id=$1",
    [driverId]
  );

  return result.rows[0];
}

async function getAllDrivers() {
  const result = await pool.query(
    "SELECT * FROM drivers ORDER BY name"
  );

  return result.rows;
}

module.exports = {
  createDriver,
  getDriver,
  getAllDrivers
};
