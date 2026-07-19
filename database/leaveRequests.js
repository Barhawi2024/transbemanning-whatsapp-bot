const { query } = require('./connection');

async function createLeaveRequest({
  driverId,
  phone,
  name,
  fromDate,
  toDate
}) {
  const result = await query(
    `
    INSERT INTO leave_requests (
      driver_id,
      phone,
      name,
      from_date,
      to_date,
      status
    )
    VALUES ($1, $2, $3, $4, $5, 'pending')
    RETURNING *
    `,
    [driverId, phone, name, fromDate, toDate]
  );

  return result.rows[0];
}

async function getPendingLeaveRequestByDriver(driverId) {
  const result = await query(
    `
    SELECT *
    FROM leave_requests
    WHERE driver_id = $1
      AND status = 'pending'
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [driverId]
  );

  return result.rows[0] || null;
}

async function updateLeaveRequestStatus({
  requestId,
  status,
  approvedBy
}) {
  const result = await query(
    `
    UPDATE leave_requests
    SET
      status = $1,
      approved_by = $2,
      updated_at = NOW()
    WHERE id = $3
    RETURNING *
    `,
    [status, approvedBy, requestId]
  );

  return result.rows[0] || null;
}

async function listLeaveRequests(status = null) {
  if (status) {
    const result = await query(
      `
      SELECT *
      FROM leave_requests
      WHERE status = $1
      ORDER BY created_at DESC
      `,
      [status]
    );

    return result.rows;
  }

  const result = await query(
    `
    SELECT *
    FROM leave_requests
    ORDER BY created_at DESC
    `
  );

  return result.rows;
}

module.exports = {
  createLeaveRequest,
  getPendingLeaveRequestByDriver,
  updateLeaveRequestStatus,
  listLeaveRequests
};
