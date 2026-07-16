const cron = require("node-cron");
const axios = require("axios");

const {
  query,
  getActiveSessions
} = require("../database");

const LIMIT_MINUTES = 1;

async function sendWhatsAppText(to, body) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    throw new Error("WhatsApp-inställningar saknas.");
  }

  await axios.post(
    `https://graph.facebook.com/v23.0/${phoneNumberId}/messages`,
    {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: {
        preview_url: false,
        body
      }
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      }
    }
  );
}

async function checkLongSessions() {
  try {
    const adminPhone = process.env.ADMIN_PHONE;

    if (!adminPhone) {
      console.error("❌ ADMIN_PHONE saknas.");
      return;
    }

    const result = await query(
      `
        SELECT
          ws.id,
          ws.driver_id,
          ws.vehicle_number,
          ws.check_in_at,
          d.name
        FROM work_sessions ws
        LEFT JOIN drivers d
          ON d.driver_id = ws.driver_id
        WHERE ws.check_out_at IS NULL
          AND ws.warning_sent = FALSE
          AND ws.check_in_at <= NOW() - INTERVAL '8 hours 30 minutes'
        ORDER BY ws.check_in_at ASC
      `
    );

    for (const session of result.rows) {
      const checkInTime = new Date(session.check_in_at);

      const activeMinutes = Math.floor(
        (Date.now() - checkInTime.getTime()) / 60000
      );

      const hours = Math.floor(activeMinutes / 60);
      const minutes = activeMinutes % 60;

      const swedishTime = checkInTime.toLocaleString("sv-SE", {
        timeZone: "Europe/Stockholm"
      });

      const message = `⚠️ Långt arbetspass

Förare: ${session.name || session.driver_id}
ID: ${session.driver_id}
Bil: ${session.vehicle_number || "Saknas"}
Incheckad: ${swedishTime}
Aktiv tid: ${hours} h ${String(minutes).padStart(2, "0")} min

Föraren är fortfarande incheckad.`;

      await sendWhatsAppText(adminPhone, message);

      await query(
        `
          UPDATE work_sessions
          SET
            warning_sent = TRUE,
            updated_at = NOW()
          WHERE id = $1
        `,
        [session.id]
      );

      console.log(
        `✅ Långpassvarning skickad en gång för förare ${session.driver_id}`
      );
    }
  } catch (error) {
    console.error(
      "❌ Fel vid kontroll av långa arbetspass:",
      error.response?.data || error.message
    );
  }
}
function startLongSessionAlertJob() {
  cron.schedule(
    "*/10 * * * *",
    checkLongSessions,
    {
      timezone: "Europe/Stockholm"
    }
  );

  console.log(
    "✅ Kontroll av pass över 8 h 30 min körs var tionde minut."
  );
}
module.exports = {
  startLongSessionAlertJob,
  checkLongSessions
};
