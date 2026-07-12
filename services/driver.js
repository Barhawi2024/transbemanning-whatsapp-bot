const { createDriver, getAllDrivers } = require('../database');

async function registerDriver({ name, phone, vehicleNumber }) {
  return createDriver(name, name, phone);
}

async function getDrivers() {
  return getAllDrivers();
}

module.exports = {
  registerDriver,
  getDrivers
};
