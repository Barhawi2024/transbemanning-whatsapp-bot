const { v4: uuidv4 } = require('uuid');

const state = {
  messages: [],
  drivers: [],
  activities: []
};

async function initDatabase() {
  return true;
}

async function saveMessage(payload) {
  const record = {
    id: uuidv4(),
    ...payload,
    createdAt: new Date().toISOString()
  };
  state.messages.push(record);
  return record;
}

async function listMessages() {
  return [...state.messages];
}

async function saveDriver(driver) {
  const record = {
    id: uuidv4(),
    ...driver,
    createdAt: new Date().toISOString()
  };
  state.drivers.push(record);
  return record;
}

async function listDrivers() {
  return [...state.drivers];
}

async function saveActivity(activity) {
  const record = {
    id: uuidv4(),
    ...activity,
    createdAt: new Date().toISOString()
  };
  state.activities.push(record);
  return record;
}

module.exports = {
  initDatabase,
  saveMessage,
  listMessages,
  saveDriver,
  listDrivers,
  saveActivity
};
