const { query } = require('./connection');

function getMonthRange(year, month) {
  const y = Number(year);
  const m = Number(month);

  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) {
    throw new Error('Ogiltigt år eller månad');
  }

  return {
    from: new Date(Date.UTC(y, m - 1, 1)),
    to: new Date(Date.UTC(y, m, 1))
  };
}

function minutesToHoursText(totalMinutes) {
  const minutes = Math.max(
    0,
    Math.round(Number(totalMinutes) || 0)
  );

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return `${hours} h ${String(remainingMinutes).padStart(2, '0')} min`;
}

async function getDriverMonthlyReport(driverId, year, month) {
  const { from, to } = getMonthRange(year, month);

  const driverResult = await query(
    `
      SELECT *
      FROM drivers
      WHERE driver_id = $1
      LIMIT 1
    `,
    [driverId]
  );

  const sessionsResult = await query(
    `
      SELECT
        ws.*,
        GREATEST(
          0,
          FLOOR(
            EXTRACT(
              EPOCH FROM (
                ws.check_out_at - ws.check_in_at
              )
            ) / 60
          ) - COALESCE(ws.break_minutes, 0)
        )::INTEGER AS worked_minutes
      FROM work_sessions ws
      WHERE ws.driver_id = $1
        AND ws.check_in_at >= $2
        AND ws.check_in_at < $3
      ORDER BY ws.check_in_at ASC
    `,
    [driverId, from, to]
  );

  const totalsResult = await query(
    `
      SELECT
        COUNT(*) FILTER (
          WHERE check_out_at IS NOT NULL
        )::INTEGER AS closed_sessions,

        COUNT(*) FILTER (
          WHERE check_out_at IS NULL
        )::INTEGER AS open_sessions,

        COALESCE(
          SUM(
            GREATEST(
              0,
              FLOOR(
                EXTRACT(
                  EPOCH FROM (
                    check_out_at - check_in_at
                  )
                ) / 60
              ) - COALESCE(break_minutes, 0)
            )
          ) FILTER (
            WHERE check_out_at IS NOT NULL
          ),
          0
        )::INTEGER AS total_minutes
      FROM work_sessions
      WHERE driver_id = $1
        AND check_in_at >= $2
        AND check_in_at < $3
    `,
    [driverId, from, to]
  );

  const totals = totalsResult.rows[0];

  return {
    driver: driverResult.rows[0] || null,
    year: Number(year),
    month: Number(month),
    sessions: sessionsResult.rows,
    totals: {
      closedSessions: totals.closed_sessions,
      openSessions: totals.open_sessions,
      totalMinutes: totals.total_minutes,
      totalText: minutesToHoursText(
        totals.total_minutes
      )
    }
  };
}

async function getCompanyMonthlyReport(year, month) {
  const { from, to } = getMonthRange(year, month);

  const result = await query(
    `
      SELECT
        d.driver_id,
        d.name,
        d.phone,
        d.vehicle_number,

        COUNT(ws.id) FILTER (
          WHERE ws.check_out_at IS NOT NULL
        )::INTEGER AS closed_sessions,

        COUNT(ws.id) FILTER (
          WHERE ws.check_out_at IS NULL
        )::INTEGER AS open_sessions,

        COALESCE(
          SUM(
            GREATEST(
              0,
              FLOOR(
                EXTRACT(
                  EPOCH FROM (
                    ws.check_out_at - ws.check_in_at
                  )
                ) / 60
              ) - COALESCE(ws.break_minutes, 0)
            )
          ) FILTER (
            WHERE ws.check_out_at IS NOT NULL
          ),
          0
        )::INTEGER AS total_minutes

      FROM drivers d

      LEFT JOIN work_sessions ws
        ON ws.driver_id = d.driver_id
        AND ws.check_in_at >= $1
        AND ws.check_in_at < $2

      WHERE d.is_active = TRUE

      GROUP BY
        d.id,
        d.driver_id,
        d.name,
        d.phone,
        d.vehicle_number

      ORDER BY
        d.name NULLS LAST,
        d.driver_id
    `,
    [from, to]
  );

  const drivers = result.rows.map((driver) => ({
    ...driver,
    totalText: minutesToHoursText(
      driver.total_minutes
    )
  }));

  const companyTotalMinutes = drivers.reduce(
    (sum, driver) =>
      sum + Number(driver.total_minutes || 0),
    0
  );

  return {
    year: Number(year),
    month: Number(month),
    drivers,
    companyTotalMinutes,
    companyTotalText: minutesToHoursText(
      companyTotalMinutes
    )
  };
}

async function getDailyReport(date = new Date()) {
  const from = new Date(date);
  from.setUTCHours(0, 0, 0, 0);

  const to = new Date(from);
  to.setUTCDate(to.getUTCDate() + 1);

  const result = await query(
    `
      SELECT
        ws.*,
        d.name,
        d.phone,

        GREATEST(
          0,
          FLOOR(
            EXTRACT(
              EPOCH FROM (
                ws.check_out_at - ws.check_in_at
              )
            ) / 60
          ) - COALESCE(ws.break_minutes, 0)
        )::INTEGER AS worked_minutes

      FROM work_sessions ws

      LEFT JOIN drivers d
        ON d.driver_id = ws.driver_id

      WHERE ws.check_in_at >= $1
        AND ws.check_in_at < $2

      ORDER BY ws.check_in_at ASC
    `,
    [from, to]
  );

  return result.rows;
}

module.exports = {
  getMonthRange,
  minutesToHoursText,
  getDriverMonthlyReport,
  getCompanyMonthlyReport,
  getDailyReport
};
