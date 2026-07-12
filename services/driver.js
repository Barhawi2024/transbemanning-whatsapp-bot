const {
  createDriver,
  getAllDrivers,
  getDriver,
  getDriverByPhone
} = require('../database');

async function registerDriver({
  driverId,
  name = null,
  phone = null,
  vehicleNumber = null
}) {
  return createDriver(
    driverId,
    name || driverId,
    phone,
    vehicleNumber
  );
}

async function getDrivers() {
  return getAllDrivers();
}

async function findDriverById(driverId) {
  return getDriver(driverId);
}

async function findDriverByPhone(phone) {
  return getDriverByPhone(phone);
}

module.exports = {
  registerDriver,
  getDrivers,
  findDriverById,
  findDriverByPhone
};
