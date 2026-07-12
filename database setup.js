const { query } = require('./connection');

async function setupDatabase() {
  await query(`
    CREATE TABLE IF NOT EXISTS drivers (
      id BIGSERIAL PRIMARY KEY,
      driver_id VARCHAR(20) UNIQUE NOT NULL,
      name VARCHAR(100),
      phone VARCHAR(30) UNIQUE,
      vehicle_number VARCHAR(30),
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS messages (
      id BIGSERIAL PRIMARY KEY,
      whatsapp_message_id VARCHAR(150) UNIQUE,
      sender VARCHAR(50) NOT NULL,
      body TEXT,
      message_type VARCHAR(30) DEFAULT 'text',
      direction VARCHAR(20) NOT NULL DEFAULT 'incoming',
      raw_payload JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS activities (
      id BIGSERIAL PRIMARY KEY,
      driver_id VARCHAR(20),
      sender VARCHAR(50) NOT NULL,
      action VARCHAR(50) NOT NULL,
      command_text TEXT,
      vehicle_number VARCHAR(30),
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS work_sessions (
      id BIGSERIAL PRIMARY KEY,
      driver_id VARCHAR(20) NOT NULL,
      sender VARCHAR(50) NOT NULL,
      vehicle_number VARCHAR(30),
      check_in_at TIMESTAMPTZ NOT NULL,
      check_out_at TIMESTAMPTZ,
      break_minutes INTEGER NOT NULL DEFAULT 0,
      status VARCHAR(20) NOT NULL DEFAULT 'open',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_messages_sender
    ON messages(sender);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_activities_driver_id
    ON activities(driver_id);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_work_sessions_driver_id
    ON work_sessions(driver_id);
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_one_open_session_per_driver
    ON work_sessions(driver_id)
    WHERE check_out_at IS NULL;
  `);

  console.log('✅ Database tables ready');
}

module.exports = setupDatabase;
