const { query } = require('./connection');

function normalizePhone(phone = '') {
  return String(phone).replace(/\D/g, '');
}

async function addAdmin(phone, name = null) {
  const normalizedPhone = normalizePhone(phone);

  const result = await query(
    `
      INSERT INTO admins (
        phone,
        name,
        is_active
      )
      VALUES ($1, $2, TRUE)
      ON CONFLICT (phone)
      DO UPDATE SET
        name = COALESCE(EXCLUDED.name, admins.name),
        is_active = TRUE,
        updated_at = NOW()
      RETURNING *
    `,
    [normalizedPhone, name]
  );

  return result.rows[0];
}

async function removeAdmin(phone) {
  const normalizedPhone = normalizePhone(phone);

  const result = await query(
    `
      UPDATE admins
      SET
        is_active = FALSE,
        updated_at = NOW()
      WHERE phone = $1
      RETURNING *
    `,
    [normalizedPhone]
  );

  return result.rows[0] || null;
}

async function isAdmin(phone) {
  const normalizedPhone = normalizePhone(phone);
  const mainAdminPhone = normalizePhone(
    process.env.ADMIN_PHONE || ''
  );

  if (
    mainAdminPhone &&
    normalizedPhone === mainAdminPhone
  ) {
    return true;
  }

  const result = await query(
    `
      SELECT id
      FROM admins
      WHERE phone = $1
        AND is_active = TRUE
      LIMIT 1
    `,
    [normalizedPhone]
  );

  return result.rowCount > 0;
}

async function listAdmins() {
  const result = await query(
    `
      SELECT *
      FROM admins
      WHERE is_active = TRUE
      ORDER BY name NULLS LAST, phone
    `
  );

  return result.rows;
}

module.exports = {
  normalizePhone,
  addAdmin,
  removeAdmin,
  isAdmin,
  listAdmins
};
