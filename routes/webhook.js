const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const {
  saveMessage,
  listMessages,
  getAllDrivers,
  saveActivity,
  getDriverByPhone,
  checkIn,
  checkOut
} = require('../database');
const { registerDriver } = require('../services/driver');
const { buildReport } = require('../services/report');
const { generatePdfReport } = require('../services/pdf');
const { generateExcelReport } = require('../services/excel');
const { distanceBetweenPoints } = require('../services/gps');

const router = express.Router();



async function sendWhatsAppText(to, body) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    return null;
  }

  const apiVersion = process.env.WHATSAPP_API_VERSION || 'v20.0';
  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

  return axios.post(
    url,
    {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body }
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );
}

async function handleIncomingMessage(message, contact) {
  const text = message.text?.body || '';
  const normalized = text.trim().toLowerCase();
  console.log("TEXT:", text);
console.log("NORMALIZED:", normalized);
  const sender = contact?.wa_id || message.from || 'unknown';

  const savedMessage = await saveMessage({
    sender,
    type: message.type,
    body: text
  });

  if (!text) {
    return 'Received an empty message.';
  }

  if (/^reg\b/.test(normalized)) {
    const adminPhone = process.env.ADMIN_PHONE;

if (sender !== adminPhone) {
  return '❌ Endast administratören kan registrera förare.';
}
    const parts = text.trim().split(/\s+/);
    const driverId = parts[1];
const phone = parts[2] || sender;
const vehicleNumber = parts[3] || 'N/A';

if (!/^\d{4}$/.test(driverId)) {
  return '❌ Förar-ID måste vara exakt 4 siffror.\nExempel: REG 1001 0738703522 MNS092';
}

await registerDriver({
  driverId,
  name: driverId,
  phone,
  vehicleNumber
});

await saveActivity({
  sender,
  action: 'register-driver',
  body: text
});

return `✅ Förare registrerad.
ID: ${driverId}
Telefon: ${phone}
Bil: ${vehicleNumber}`;
  }

  if (normalized.includes('report')) {
    const messages = await listMessages();
    const drivers = await getAllDrivers();
    const report = buildReport({ messages, drivers });
    await saveActivity({ sender, action: 'generate-report', body: text });
    return `Report ready. Messages: ${report.messageCount}. Drivers: ${report.driverCount}.`;
  }

  if (normalized.includes('pdf')) {
    const messages = await listMessages();
    const drivers = await getAllDrivers();
    const report = buildReport({ messages, drivers });
    const pdfBuffer = await generatePdfReport(report);
    const outputDir = path.join(__dirname, '..', 'tmp');
    fs.mkdirSync(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, 'report.pdf');
    fs.writeFileSync(outputPath, pdfBuffer);
    await saveActivity({ sender, action: 'generate-pdf', body: text });
    return 'PDF report generated and saved.';
  }

  if (normalized.includes('excel')) {
    const messages = await listMessages();
    const drivers = await getAllDrivers();
    const report = buildReport({ messages, drivers });
    const excelBuffer = await generateExcelReport(report);
    const outputDir = path.join(__dirname, '..', 'tmp');
    fs.mkdirSync(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, 'report.xlsx');
    fs.writeFileSync(outputPath, excelBuffer);
    await saveActivity({ sender, action: 'generate-excel', body: text });
    return 'Excel report generated and saved.';
  }

  if (normalized.includes('gps')) {
    const match = text.match(/(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)/);
    if (match) {
      const lat = parseFloat(match[1]);
      const lon = parseFloat(match[2]);
      const distance = distanceBetweenPoints({ lat, lon }, { lat: 59.3293, lon: 18.0686 });
      await saveActivity({ sender, action: 'gps-check', body: text });
      return `Distance to Stockholm: ${distance.toFixed(2)} km`;
    }
    return 'Send GPS coordinates like: gps 59.3293, 18.0686';
  }
  const swedishTime = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Stockholm',
  hour: '2-digit',
  minute: '2-digit'
}).format(new Date());

if (normalized === 'in') {
  const driver = await getDriverByPhone(sender);

  if (!driver) {
    return '❌ Ditt telefonnummer är inte registrerat. Kontakta administratören.';
  }

  const result = await checkIn({
    driverId: driver.driver_id,
    sender,
    vehicleNumber: driver.vehicle_number
  });

  if (result.alreadyOpen) {
    const previousTime = new Date(
      result.session.check_in_at
    ).toLocaleString('sv-SE', {
      timeZone: 'Europe/Stockholm'
    });

    return `⚠️ Du är redan incheckad.\nTid: ${previousTime}`;
  }

  await saveActivity({
    driverId: driver.driver_id,
    sender,
    action: 'check-in',
    commandText: text,
    vehicleNumber: driver.vehicle_number
  });

  return `✅ Incheckning registrerad.
ID: ${driver.driver_id}
Bil: ${driver.vehicle_number || '-'}
Tid: ${swedishTime}

Ha en bra arbetsdag!`;
}
if (normalized === 'ut' || normalized === 'out') {
  const driver = await getDriverByPhone(sender);

  if (!driver) {
    return '❌ Ditt telefonnummer är inte registrerat. Kontakta administratören.';
  }

  const result = await checkOut({
    driverId: driver.driver_id,
    breakMinutes: 0
  });

  if (result.noOpenSession) {
    return '⚠️ Du har ingen aktiv incheckning att avsluta.';
  }

  const checkInTime = new Date(
    result.session.check_in_at
  );

  const checkOutTime = new Date(
    result.session.check_out_at
  );

  const totalMinutes = Math.max(
    0,
    Math.floor(
      (checkOutTime.getTime() - checkInTime.getTime()) / 60000
    ) - Number(result.session.break_minutes || 0)
  );

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  await saveActivity({
    driverId: driver.driver_id,
    sender,
    action: 'check-out',
    commandText: text,
    vehicleNumber: driver.vehicle_number,
    metadata: {
      workedMinutes: totalMinutes
    }
  });

  return `✅ Utcheckning registrerad.
ID: ${driver.driver_id}
Tid: ${swedishTime}
Arbetstid: ${hours} h ${String(minutes).padStart(2, '0')} min`;
}
await saveActivity({
  sender,
  action: 'echo',
  body: text
});

return `❌ Okänt kommando.\n\nAnvänd:\nIN – checka in\nUT – checka ut`;
}

router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});
router.post('/', async (req, res) => {
  try {
    const entries = req.body.entry || [];
    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        const contacts = value.contacts || [];
        const messages = value.messages || [];

        for (const message of messages) {
          const contact = contacts.find((item) => item.wa_id === message.from) || contacts[0] || {};
          const replyText = await handleIncomingMessage(message, contact);
          if (message.from) {
            await sendWhatsAppText(message.from, replyText);
          }
        }
      }
    }
    res.sendStatus(200);
  } catch (error) {
    console.error('Webhook error', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
