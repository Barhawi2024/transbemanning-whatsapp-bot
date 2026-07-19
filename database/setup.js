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
  ALTER TABLE pending_actions
  ADD COLUMN IF NOT EXISTS metadata JSONB
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
  await query(`
    CREATE TABLE IF NOT EXISTS commands (
      id BIGSERIAL PRIMARY KEY,
      sender VARCHAR(50) NOT NULL,
      driver_id VARCHAR(20),
      command VARCHAR(50) NOT NULL,
      command_text TEXT,
      status VARCHAR(30) NOT NULL DEFAULT 'received',
      result_text TEXT,
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS admins (
      id BIGSERIAL PRIMARY KEY,
      phone VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(100),
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS gps_locations (
      id BIGSERIAL PRIMARY KEY,
      driver_id VARCHAR(20),
      sender VARCHAR(50) NOT NULL,
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      accuracy DOUBLE PRECISION,
      address TEXT,
      captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_commands_sender
    ON commands(sender);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_commands_driver_id
    ON commands(driver_id);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_gps_driver_id
    ON gps_locations(driver_id);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_gps_captured_at
    ON gps_locations(captured_at DESC);
  `);
  

  await query(`
    CREATE TABLE IF NOT EXISTS pending_actions (
      sender VARCHAR(50) PRIMARY KEY,
      driver_id VARCHAR(20),
      action VARCHAR(50) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
await query(`
  ALTER TABLE work_sessions
  ADD COLUMN IF NOT EXISTS warning_sent BOOLEAN NOT NULL DEFAULT FALSE;
`);
await query(`
  CREATE TABLE IF NOT EXISTS allowed_locations (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    radius_meters INTEGER NOT NULL DEFAULT 25,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`);
await query(`
CREATE TABLE IF NOT EXISTS leave_requests (
    id SERIAL PRIMARY KEY,
    driver_id VARCHAR(20) NOT NULL,
    phone TEXT,
    name TEXT,
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    approved_by TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
`);
  console.log('✅ Database tables ready');
}

module.exports = setupDatabase;
