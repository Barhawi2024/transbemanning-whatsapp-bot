const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL saknas i Railway Variables');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false
});

pool.on('connect', () => {
  console.log('✅ PostgreSQL connected');
});

pool.on('error', (error) => {
  console.error('❌ PostgreSQL pool error:', error);
});

async function query(text, params = []) {
  return pool.query(text, params);
}

module.exports = {
  pool,
  query
};
