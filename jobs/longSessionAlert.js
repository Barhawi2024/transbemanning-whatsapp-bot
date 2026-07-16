const cron = require("node-cron");
const axios = require("axios");

const {
  query,
  getActiveSessions
} = require("../database");

const LIMIT_MINUTES = 8 * 60 + 30;

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

    const activeSessions = await getActiveSessions();
    const now = new Date();

    for (const session of activeSessions) {
      const checkInTime = new Date(session.check_in_at);

      const activeMinutes = Math.floor(
        (now.getTime() - checkInTime.getTime()) / 60000
      );

      if (activeMinutes < LIMIT_MINUTES) {
        continue;
      }

      const alertKey = `long-session-${session.id}`;

      const existingAlert = await query(
        `
          SELECT 1
          FROM activities
          WHERE action = $1
          LIMIT 1
        `,
        [alertKey]
      );

      if (existingAlert.rows.length) {
        continue;
      }

      const hours = Math.floor(activeMinutes / 60);
      const minutes = activeMinutes % 60;

      const swedishTime = checkInTime.toLocaleString("sv-SE", {
        timeZone: "Europe/Stockholm"
      });

      const message = `⚠️ Långt arbetspass

Förare: ${session.driver_id}
Bil: ${session.vehicle_number || "Saknas"}
Incheckad: ${swedishTime}
Aktiv tid: ${hours} h ${String(minutes).padStart(2, "0")} min

Föraren är fortfarande incheckad.`;

      await sendWhatsAppText(adminPhone, message);

      await query(
        `
          INSERT INTO activities (
            sender,
            action,
            body
          )
          VALUES ($1, $2, $3)
        `,
        [
          adminPhone,
          alertKey,
          message
        ]
      );

      console.log(
        `✅ Långpassvarning skickad för förare ${session.driver_id}`
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
