const { pool, query } = require('./connection');
const setupDatabase = require('./setup');
const { getActiveSessions } = require('./workSessions');
const drivers = require('./drivers');
const activities = require('./activities');
const messages = require('./messages');
const workSessions = require('./workSessions');
const commands = require('./commands');
const admins = require('./admins');
const gps = require('./gps');
const reports = require('./reports');
const pdfReports = require('./pdfReports');
const pendingActions = require('./pendingActions');
const { startMonthlyReportJob } = require("./jobs/monthlyReport");
module.exports = {
  pool,
  query,
  setupDatabase,
  getActiveSessions,
  ...drivers,
  ...activities,
  ...messages,
  ...workSessions,
  ...commands,
  ...admins,
  ...gps,
  ...reports,
  ...pdfReports,
  ...pendingActions
};
