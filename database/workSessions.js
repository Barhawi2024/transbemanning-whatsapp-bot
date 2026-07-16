const { query } = require('./connection');

async function checkIn({
  driverId,
  sender,
  vehicleNumber = null,
  checkInAt = new Date()
}) {
  const openSession = await getOpenSession(driverId);

  if (openSession) {
    return {
      alreadyOpen: true,
      session: openSession
    };
  }

  const result = await query(
    `
      INSERT INTO work_sessions (
        driver_id,
        sender,
        vehicle_number,
        check_in_at,
        status
      )
      VALUES ($1, $2, $3, $4, 'open')
      RETURNING *
    `,
    [driverId, sender, vehicleNumber, checkInAt]
  );

  return {
    alreadyOpen: false,
    session: result.rows[0]
  };
}

async function checkOut({
  driverId,
  checkOutAt = new Date(),
  breakMinutes = 0
}) {
  const openSession = await getOpenSession(driverId);

  if (!openSession) {
    return {
      noOpenSession: true,
      session: null
    };
  }

  const result = await query(
    `
     UPDATE work_sessions
SET
    check_out_at = $1,
    break_minutes = $2,
    status = 'closed',
    warning_sent = FALSE,
    updated_at = NOW()
WHERE id = $3
RETURNING * 
    `,
    [checkOutAt, breakMinutes, openSession.id]
  );

  return {
    noOpenSession: false,
    session: result.rows[0]
  };
}

async function getOpenSession(driverId) {
  const result = await query(
    `
      SELECT *
      FROM work_sessions
      WHERE driver_id = $1
        AND check_out_at IS NULL
      ORDER BY check_in_at DESC
      LIMIT 1
    `,
    [driverId]
  );

  return result.rows[0] || null;
}

async function getSessionsByDriver(driverId, limit = 100) {
  const result = await query(
    `
      SELECT *
      FROM work_sessions
      WHERE driver_id = $1
      ORDER BY check_in_at DESC
      LIMIT $2
    `,
    [driverId, limit]
  );

  return result.rows;
}

async function getMonthlySessions(driverId, year, month) {
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 1));

  const result = await query(
    `
      SELECT *
      FROM work_sessions
      WHERE driver_id = $1
        AND check_in_at >= $2
        AND check_in_at < $3
      ORDER BY check_in_at ASC
    `,
    [driverId, startDate, endDate]
  );

  return result.rows;
}

async function getMonthlyMinutes(driverId, year, month) {
  const sessions = await getMonthlySessions(driverId, year, month);

  let totalMinutes = 0;

  for (const session of sessions) {
    if (!session.check_out_at) {
      continue;
    }

    const checkIn = new Date(session.check_in_at);
    const checkOut = new Date(session.check_out_at);

    const workedMinutes = Math.floor(
      (checkOut.getTime() - checkIn.getTime()) / 60000
    );

    totalMinutes += Math.max(
      0,
      workedMinutes - Number(session.break_minutes || 0)
    );
  }

  return totalMinutes;
}
async function getActiveSessions() {
  const result = await query(`
    SELECT
      ws.driver_id,
      ws.check_in_at,
      d.vehicle_number,
      d.phone
    FROM work_sessions ws
    JOIN drivers d ON d.driver_id = ws.driver_id
    WHERE ws.check_out_at IS NULL
    ORDER BY ws.check_in_at ASC
  `);

  return result.rows;
}
async function updateTodaySessionTime({
  driverId,
  type,
  time
}) {
  const normalizedType = String(type || '').toUpperCase();

  if (!['IN', 'UT'].includes(normalizedType)) {
    throw new Error('Typ måste vara IN eller UT.');
  }

  if (!/^\d{2}:\d{2}$/.test(time)) {
    throw new Error('Tiden måste vara i format HH:MM.');
  }

  const sessionResult = await query(
    `
      SELECT *
      FROM work_sessions
      WHERE driver_id = $1
        AND check_in_at >= date_trunc(
          'day',
          NOW() AT TIME ZONE 'Europe/Stockholm'
        ) AT TIME ZONE 'Europe/Stockholm'
        AND check_in_at < (
          date_trunc(
            'day',
            NOW() AT TIME ZONE 'Europe/Stockholm'
          ) + INTERVAL '1 day'
        ) AT TIME ZONE 'Europe/Stockholm'
      ORDER BY check_in_at DESC
      LIMIT 1
    `,
    [driverId]
  );

  const session = sessionResult.rows[0];

  if (!session) {
    return {
      notFound: true
    };
  }

  const column =
    normalizedType === 'IN'
      ? 'check_in_at'
      : 'check_out_at';

  const updateResult = await query(
    `
      UPDATE work_sessions
      SET
        ${column} = (
          date_trunc(
            'day',
            NOW() AT TIME ZONE 'Europe/Stockholm'
          ) + $2::time
        ) AT TIME ZONE 'Europe/Stockholm',
        status = CASE
          WHEN $3 = 'UT' THEN 'closed'
          ELSE status
        END,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [session.id, time, normalizedType]
  );

  return {
    notFound: false,
    session: updateResult.rows[0]
  };
}
module.exports = {
  checkIn,
  checkOut,
  getOpenSession,
  getSessionsByDriver,
  getMonthlySessions,
  getMonthlyMinutes,
  getActiveSessions,
  updateTodaySessionTime
};
