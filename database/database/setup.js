const { query } = require('./connection');

async function setupDatabase() {

    await query(`
    CREATE TABLE IF NOT EXISTS drivers (
        id SERIAL PRIMARY KEY,
        driver_id VARCHAR(20) UNIQUE,
        phone VARCHAR(30),
        vehicle VARCHAR(30),
        created_at TIMESTAMP DEFAULT NOW()
    );
    `);

    await query(`
    CREATE TABLE IF NOT EXISTS activities (
        id SERIAL PRIMARY KEY,
        driver_id VARCHAR(20),
        action VARCHAR(20),
        created_at TIMESTAMP DEFAULT NOW()
    );
    `);

    await query(`
    CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        sender VARCHAR(50),
        body TEXT,
        created_at TIMESTAMP DEFAULT NOW()
    );
    `);

    console.log("✅ Database ready");
}

module.exports = setupDatabase;
