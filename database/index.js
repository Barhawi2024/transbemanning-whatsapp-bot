const { pool, query } = require('./connection');
const setupDatabase = require('./setup');

module.exports = {
  pool,
  query,
  setupDatabase
};
