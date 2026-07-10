const { saveDriver, listDrivers } = require('../database');

async function registerDriver({ name, phone, vehicleNumber }) {
  return saveDriver({ name, phone, vehicleNumber });
}

async function getDrivers() {
  return listDrivers();
}

module.exports = {
  registerDriver,
  getDrivers
};
