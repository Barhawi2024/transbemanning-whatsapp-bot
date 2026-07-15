const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const {
  saveMessage,
  listMessages,
  getMessageByWhatsappId,
  getAllDrivers,
  saveActivity,
  getDriverByPhone,
  checkIn,
  checkOut,
  getActiveSessions,
  saveCommand,
  getDriverMonthlyReport,
  isAdmin,
  setPendingAction,
  getPendingAction,
  clearPendingAction
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
async function sendWhatsAppDocument(to, filePath, filename) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    throw new Error('WhatsApp-inställningar saknas.');
  }

  const FormData = require('form-data');

  const form = new FormData();

  form.append('messaging_product', 'whatsapp');
  form.append('file', fs.createReadStream(filePath), {
    filename,
    contentType: 'application/pdf'
  });

  const uploadResponse = await axios.post(
    `https://graph.facebook.com/v20.0/${phoneNumberId}/media`,
    form,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        ...form.getHeaders()
      }
    }
  );

  const mediaId = uploadResponse.data.id;

  await axios.post(
    `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
    {
      messaging_product: 'whatsapp',
      to,
      type: 'document',
      document: {
        id: mediaId,
        filename
      }
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );
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
async function sendWhatsAppDocument(to, filePath, filename) {
  const token =
    process.env.WHATSAPP_TOKEN ||
    process.env.WHATSAPP_ACCESS_TOKEN;

  const phoneNumberId =
    process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    throw new Error(
      'WHATSAPP_TOKEN eller WHATSAPP_PHONE_NUMBER_ID saknas i Railway Variables.'
    );
  }

  const FormData = require('form-data');
  const form = new FormData();

  form.append('messaging_product', 'whatsapp');
  form.append('file', fs.createReadStream(filePath), {
    filename,
    contentType: 'application/pdf'
  });

  const uploadResponse = await axios.post(
    `https://graph.facebook.com/v20.0/${phoneNumberId}/media`,
    form,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        ...form.getHeaders()
      }
    }
  );

  const mediaId = uploadResponse.data.id;

  await axios.post(
    `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
    {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'document',
      document: {
        id: mediaId,
        filename
      }
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
  if (!text.trim()) {
  return null;
}
  if (message.id) {
  const existingMessage = await getMessageByWhatsappId(message.id);

  if (existingMessage) {
    console.log('Duplicate message ignored:', message.id);
    return null;
  }
}
  const normalized = text.trim().toLowerCase();
  console.log("TEXT:", text);
console.log("NORMALIZED:", normalized);
  const sender = contact?.wa_id || message.from || 'unknown';
const pendingAction = await getPendingAction(sender);

if (pendingAction?.action === 'awaiting_break_answer') {
  if (normalized === 'ja') {
    await setPendingAction({
      sender,
      driverId: pendingAction.driver_id,
      action: 'awaiting_break_minutes'
    });

    return `⏱️ Hur lång rast hade du?

Svara med:
15
30
45`;
  }

  if (normalized === 'nej') {
    const result = await checkOut({
      driverId: pendingAction.driver_id,
      breakMinutes: 0
    });

    if (result.noOpenSession) {
      await clearPendingAction(sender);
      return '⚠️ Du har ingen aktiv incheckning att avsluta.';
    }

    await clearPendingAction(sender);

    const checkInTime = new Date(result.session.check_in_at);
    const checkOutTime = new Date(result.session.check_out_at);

    const totalMinutes = Math.max(
      0,
      Math.floor(
        (checkOutTime.getTime() - checkInTime.getTime()) / 60000
      )
    );

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return `✅ Utcheckning registrerad.
Rast: 0 min
Arbetstid: ${hours} h ${String(minutes).padStart(2, '0')} min`;
  }

  return '❌ Svara endast JA eller NEJ.';
}

if (pendingAction?.action === 'awaiting_break_minutes') {
  const breakMinutes = Number(normalized);

  if (![15, 30, 45].includes(breakMinutes)) {
    return `❌ Välj endast:
15
30
45`;
  }

  const result = await checkOut({
    driverId: pendingAction.driver_id,
    breakMinutes
  });

  if (result.noOpenSession) {
    await clearPendingAction(sender);
    return '⚠️ Du har ingen aktiv incheckning att avsluta.';
  }

  await clearPendingAction(sender);

  const checkInTime = new Date(result.session.check_in_at);
  const checkOutTime = new Date(result.session.check_out_at);

  const totalMinutes = Math.max(
    0,
    Math.floor(
      (checkOutTime.getTime() - checkInTime.getTime()) / 60000
    ) - breakMinutes
  );

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `✅ Utcheckning registrerad.
Rast: ${breakMinutes} min
Arbetstid: ${hours} h ${String(minutes).padStart(2, '0')} min`;
}
  const commandName =
  normalized.split(/\s+/)[0].toUpperCase() || 'EMPTY';

await saveCommand({
  sender,
  command: commandName,
  commandText: text,
  status: 'received',
  metadata: {
    whatsappMessageId: message.id || null,
    messageType: message.type || 'text'
  }
});
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

if (/^pdf\b/i.test(normalized)) {
    const adminAllowed = await isAdmin(sender);

    if (!adminAllowed) {
        return '❌ Endast administratören kan skapa PDF-rapporter.';
    }

    const parts = text.trim().split(/\s+/);
    const driverId = parts[1];
    const monthText = parts[2];

    if (!driverId || !monthText) {
        return 'Använd: PDF 1001 2026-07';
    }

    const [year, month] = monthText.split('-').map(Number);

    const report = await getDriverMonthlyReport(driverId, year, month);

    const pdfBuffer = await generatePdfReport(report);

    const outputDir = path.join(__dirname, '..', 'tmp');
    fs.mkdirSync(outputDir, { recursive: true });

    const outputPath = path.join(outputDir, `${driverId}-${monthText}.pdf`);

    fs.writeFileSync(outputPath, pdfBuffer);
await sendWhatsAppDocument(
  sender,
  outputPath,
  `${driverId}-${monthText}.pdf`
);
    await saveActivity({
        sender,
        action: 'generate-pdf',
        body: text
    });

   return null;
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

  await setPendingAction({
    sender,
    driverId: driver.driver_id,
    action: 'awaiting_break_answer'
  });

  return `⏸️ Har du haft rast under arbetspasset?

Svara:
JA – om du har haft rast
NEJ – om du inte har haft rast`;
}

if (/^rapport\b/.test(normalized)) {
  const adminAllowed = await isAdmin(sender);

  if (!adminAllowed) {
    return '❌ Endast administratören kan skapa rapporter.';
  }

  const parts = text.trim().split(/\s+/);
  const driverId = parts[1];
  const monthText = parts[2];

  if (!driverId || !/^\d{4}$/.test(driverId)) {
    return '❌ Fel format.\nAnvänd: RAPPORT 1001 2026-07';
  }

  if (!monthText || !/^\d{4}-\d{2}$/.test(monthText)) {
    return '❌ Fel månad.\nAnvänd: RAPPORT 1001 2026-07';
  }

  const [year, month] = monthText.split('-').map(Number);

  if (month < 1 || month > 12) {
    return '❌ Månaden måste vara mellan 01 och 12.';
  }

  const report = await getDriverMonthlyReport(
    driverId,
    year,
    month
  );

  if (!report.driver) {
    return `❌ Förare med ID ${driverId} finns inte.`;
  }

  const sessionsText = report.sessions.length
    ? report.sessions.map((session, index) => {
        const inTime = new Date(
          session.check_in_at
        ).toLocaleString('sv-SE', {
          timeZone: 'Europe/Stockholm'
        });

        const outTime = session.check_out_at
          ? new Date(session.check_out_at).toLocaleString(
              'sv-SE',
              { timeZone: 'Europe/Stockholm' }
            )
          : 'Pågående';

        const workedMinutes =
          Number(session.worked_minutes || 0);

        const hours = Math.floor(workedMinutes / 60);
        const minutes = workedMinutes % 60;

return `${index + 1}. ${inTime} → ${outTime}
Rast: ${Number(session.break_minutes || 0)} min
Tid: ${hours} h ${String(minutes).padStart(2, '0')} min`;
}).join('\n\n')
: 'Inga arbetspass registrerade.';

return `📊 Månadsrapport

Förare: ${report.driver?.name || driverId}
ID: ${driverId}
Månad: ${monthText}

Antal avslutade pass: ${report.totals.closedSessions}
Pågående pass: ${report.totals.openSessions}
Total arbetstid: ${report.totals.totalText}

${sessionsText}`;
 } 
  await saveActivity({
  sender,
  action: 'echo',
  body: text
});
if (normalized === 'lista') {
  const adminAllowed = await isAdmin(sender);

  if (!adminAllowed) {
    return '❌ Endast administratören kan se förarlistan.';
  }

  const drivers = await getAllDrivers();

  if (!drivers.length) {
    return 'ℹ️ Det finns inga registrerade förare.';
  }

  const driverList = drivers.map((driver, index) => {
    return `${index + 1}. ${driver.name || driver.driver_id}
ID: ${driver.driver_id}
Telefon: ${driver.phone || '-'}
Bil: ${driver.vehicle_number || '-'}`;
  }).join('\n\n');

  return `👥 Registrerade förare: ${drivers.length}

${driverList}`;
}
if (normalized === 'aktiva') {
  const adminAllowed = await isAdmin(sender);

  if (!adminAllowed) {
    return '❌ Endast administratören kan se aktiva förare.';
  }

  const sessions = await getActiveSessions();

  if (!sessions.length) {
    return 'ℹ️ Ingen förare är incheckad just nu.';
  }

  const activeList = sessions.map((session, index) => {
    const checkInTime = new Date(
      session.check_in_at
    ).toLocaleString('sv-SE', {
      timeZone: 'Europe/Stockholm'
    });

    return `${index + 1}. ${session.name || session.driver_id}
ID: ${session.driver_id}
Bil: ${session.vehicle_number || '-'}
Incheckad: ${checkInTime}`;
  }).join('\n\n');

  return `🟢 Aktiva förare: ${sessions.length}

${activeList}`;
}
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
