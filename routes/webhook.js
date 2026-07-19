const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const {
  saveMessage,
  listMessages,
  getMessageByWhatsappId,
  getAllDrivers,
  deactivateDriver,
  permanentlyDeleteDriver,
  saveActivity,
  getDriverByPhone,
  checkIn,
  checkOut,
  getActiveSessions,
  saveCommand,
  getDriverMonthlyReport,
  isAdmin,
  addAdmin,
removeAdmin,
listAdmins,
  findDriver,
  updateTodaySessionTime,
  setPendingAction,
  getPendingAction,
  clearPendingAction,
  addAllowedLocation,
  getAllowedLocations,
  saveGpsLocation,
  deactivateAllowedLocation
} = require('../database');
const { registerDriver } = require('../services/driver');
const {
  buildReport,
  buildMonthlyCompanyReport
} = require('../services/report');
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
const sender = contact?.wa_id || message.from || 'unknown';
const isLocation =
  message.type === 'location' &&
  message.location;

const text = message.text?.body || '';

if (!text.trim() && !isLocation) {
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

const pendingAction = await getPendingAction(sender);
if (
  pendingAction?.action === 'awaiting_private_message' &&
  !isLocation
) {
  if (normalized === 'avbryt') {
    await clearPendingAction(sender);
    return '✅ Meddelandet har avbrutits.';
  }

  const messageText = text.trim();

  if (!messageText) {
    return '❌ Meddelandet får inte vara tomt.';
  }

  const phone = pendingAction.metadata?.phone;
  const name = pendingAction.metadata?.name;
  const driverId = pendingAction.metadata?.driverId;

  if (!phone) {
    await clearPendingAction(sender);
    return '❌ Förarens telefonnummer saknas. Försök igen.';
  }

  await setPendingAction({
    sender,
    driverId,
    action: 'awaiting_private_message_confirmation',
    metadata: {
      phone,
      name,
      driverId,
      messageText
    }
  });

  return `📢 Du är på väg att skicka:

${messageText}

Till: ${driverId} – ${name}

Svara JA för att skicka.
Svara AVBRYT för att avbryta.`;
}
if (
  pendingAction?.action === 'awaiting_private_message_confirmation' &&
  !isLocation
) {
  if (normalized === 'avbryt') {
    await clearPendingAction(sender);
    return '✅ Meddelandet har avbrutits.';
  }

  if (normalized !== 'ja') {
    return `Svara:

JA – skicka meddelandet
AVBRYT – avbryt`;
  }

  const phone = pendingAction.metadata?.phone;
  const name = pendingAction.metadata?.name;
  const driverId = pendingAction.metadata?.driverId;
  const messageText = pendingAction.metadata?.messageText;

  if (!phone || !messageText) {
    await clearPendingAction(sender);
    return '❌ Uppgifter saknas. Försök igen.';
  }

  try {
    await sendWhatsAppText(
      phone,
      `📢 Meddelande från TransBemanning

${messageText}

TransBemanning AB`
    );

    await clearPendingAction(sender);

    return `✅ Meddelandet skickades till:

${driverId} – ${name}`;
  } catch (error) {
    console.error(
      'Kunde inte skicka privat meddelande:',
      error.response?.data || error.message
    );

    await clearPendingAction(sender);

    return `❌ Meddelandet kunde inte skickas till ${name}.`;
  }
}
// Administratören skriver meddelandet som ska skickas till alla
if (
  pendingAction?.action === 'awaiting_broadcast_message' &&
  !isLocation
) {
  if (normalized === 'avbryt') {
    await clearPendingAction(sender);
    return '✅ Utskicket har avbrutits.';
  }

  const messageText = text.trim();

  if (!messageText) {
    return '❌ Meddelandet får inte vara tomt.';
  }

  const drivers = await getAllDrivers();

  const activeDrivers = drivers.filter(
    (driver) => driver.is_active !== false && driver.phone
  );

  if (activeDrivers.length === 0) {
    await clearPendingAction(sender);
    return '❌ Det finns inga aktiva registrerade förare.';
  }

  await setPendingAction({
    sender,
    driverId: null,
    action: 'awaiting_broadcast_confirmation',
    metadata: {
      messageText,
      recipientCount: activeDrivers.length
    }
  });

  return `📢 Du är på väg att skicka följande meddelande:

${messageText}

👥 Mottagare: ${activeDrivers.length} förare

Svara JA för att skicka.
Svara AVBRYT för att avbryta.`;
}


// Administratören bekräftar utskicket
if (
  pendingAction?.action === 'awaiting_broadcast_confirmation' &&
  !isLocation
) {
  if (normalized === 'avbryt') {
    await clearPendingAction(sender);
    return '✅ Utskicket har avbrutits.';
  }

  if (normalized !== 'ja') {
    return `Svara:

JA – skicka meddelandet
AVBRYT – avbryt utskicket`;
  }

  const messageText = pendingAction.metadata?.messageText;

  if (!messageText) {
    await clearPendingAction(sender);
    return '❌ Meddelandet saknas. Försök igen med MEDDELANDE ALLA.';
  }

  const drivers = await getAllDrivers();

  const activeDrivers = drivers.filter(
    (driver) => driver.is_active !== false && driver.phone
  );

  let succeeded = 0;
  let failed = 0;

  for (const driver of activeDrivers) {
    try {
      await sendWhatsAppText(
        driver.phone,
        `📢 Viktig information från TransBemanning

${messageText}

TransBemanning AB`
      );

      succeeded++;
    } catch (error) {
      console.error(
        `Kunde inte skicka meddelande till ${driver.phone}:`,
        error.response?.data || error.message
      );

      failed++;
    }
  }

  await clearPendingAction(sender);

  return `✅ Utskicket är klart.

👥 Mottagare: ${activeDrivers.length}
✅ Lyckades: ${succeeded}
❌ Misslyckades: ${failed}`;
}
if (isLocation) {
  const latitude = Number(message.location.latitude);
  const longitude = Number(message.location.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return '❌ Kunde inte läsa positionen. Försök skicka platsen igen.';
  }
if (pendingAction?.action === 'awaiting_new_allowed_location') {
  const { name, radiusMeters } = pendingAction.metadata;

  const location = await addAllowedLocation({
    name,
    latitude,
    longitude,
    radiusMeters
  });

  await clearPendingAction(sender);

  return `✅ Arbetsplats sparad.

Namn: ${location.name}
Latitud: ${location.latitude}
Longitud: ${location.longitude}
Radie: ${location.radius_meters} meter`;
}
const isCheckInLocation =
  pendingAction?.action === 'awaiting_checkin_location';

const isCheckOutLocation =
  pendingAction?.action === 'awaiting_checkout_location';

if (!isCheckInLocation && !isCheckOutLocation) {
  return `📍 Position mottagen.

Latitud: ${latitude}
Longitud: ${longitude}

Skriv IN eller UT först.`;
}

  const allowedLocations = await getAllowedLocations();

  if (!allowedLocations.length) {
    return '❌ Det finns inga godkända arbetsplatser registrerade.';
  }

  let nearestLocation = null;
  let nearestDistanceMeters = Infinity;

  for (const location of allowedLocations) {
    const distanceKm = distanceBetweenPoints(
      {
        lat: latitude,
        lon: longitude
      },
      {
        lat: Number(location.latitude),
        lon: Number(location.longitude)
      }
    );

    const distanceMeters = distanceKm * 1000;

    if (distanceMeters < nearestDistanceMeters) {
      nearestDistanceMeters = distanceMeters;
      nearestLocation = location;
    }
  }

  if (
    !nearestLocation ||
    nearestDistanceMeters > nearestLocation.radius_meters
  ) {
    return `❌ Incheckning nekad.

Närmaste plats: ${nearestLocation?.name || 'Okänd'}
Avstånd: ${Math.round(nearestDistanceMeters)} meter
Tillåten radie: ${nearestLocation?.radius_meters || 25} meter

Skicka en ny aktuell plats när du är på arbetsplatsen.`;
  }

  const driver = await getDriverByPhone(sender);

  if (!driver) {
    await clearPendingAction(sender);

    return '❌ Ditt telefonnummer är inte registrerat.';
  }

if (isLocation && isCheckInLocation) {
  const result = await checkIn({
    driverId: driver.driver_id,
    sender,
    vehicleNumber: driver.vehicle_number
  });

  if (result.alreadyOpen) {
    await clearPendingAction(sender);

    return '⚠️ Du är redan incheckad.';
  }

  await saveGpsLocation({
    driverId: driver.driver_id,
    sender,
    latitude,
    longitude,
    accuracy: message.location.accuracy || null,
    address: nearestLocation.name,
    capturedAt: new Date(),
    metadata: {
      action: 'IN',
      allowedLocationId: nearestLocation.id,
      allowedLocationName: nearestLocation.name,
      distanceMeters: Math.round(nearestDistanceMeters)
    }
  });

  await clearPendingAction(sender);

  return `✅ Incheckning registrerad.

ID: ${driver.driver_id}
Bil: ${driver.vehicle_number || 'Saknas'}
Plats: ${nearestLocation.name}
Avstånd: ${Math.round(nearestDistanceMeters)} meter`;
}
if (isLocation && isCheckOutLocation) {
  await saveGpsLocation({
    driverId: driver.driver_id,
    sender,
    latitude,
    longitude,
    accuracy: message.location.accuracy || null,
    address: nearestLocation.name,
    capturedAt: new Date(),
    metadata: {
      action: 'UT',
      allowedLocationId: nearestLocation.id,
      allowedLocationName: nearestLocation.name,
      distanceMeters: Math.round(nearestDistanceMeters)
    }
  });

  await setPendingAction({
    sender,
    driverId: driver.driver_id,
    action: 'awaiting_break_answer'
  });

  return `📍 Utcheckningsplats godkänd.

Plats: ${nearestLocation.name}
Avstånd: ${Math.round(nearestDistanceMeters)} meter

Har du haft rast?

Svara:
JA – om du har haft rast
NEJ – om du inte har haft rast`;
}
}

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
if (/^admin rapport\b/i.test(normalized)) {
    const adminAllowed = await isAdmin(sender);

    if (!adminAllowed) {
        return "❌ Endast administratören kan använda ADMIN RAPPORT.";
    }

    const parts = text.trim().split(/\s+/);

    if (parts.length < 3) {
        return "Använd: ADMIN RAPPORT 2026-07";
    }

    const monthText = parts[2];
    const [year, month] = monthText.split("-").map(Number);

    const report = await buildMonthlyCompanyReport(year, month);

    return report;
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
if (/^ändra\b/i.test(normalized)) {
  const adminAllowed = await isAdmin(sender);

  if (!adminAllowed) {
    return "❌ Endast administratören kan använda ÄNDRA.";
  }

  const parts = text.trim().split(/\s+/);
 const driverId = parts[1];
const date = parts[2];
const type = parts[3]?.toUpperCase();
const time = parts[4];

  if (!driverId || !date || !type || !time) {
    return "Använd: ÄNDRA 1001 2026-07-16 IN 07:15";
  }

  if (!["IN", "UT"].includes(type)) {
    return "❌ Du kan bara använda IN eller UT.";
  }

  if (!/^\d{2}:\d{2}$/.test(time)) {
    return "❌ Tiden måste skrivas som HH:MM, exempel 07:15.";
  }

const result = await updateTodaySessionTime({
    driverId,
    date,
    type,
    time
});

  if (result.notFound) {
    return `❌ Inget arbetspass hittades idag för förare ${driverId}.`;
  }

  const session = result.session;

  return `✅ Tiden har ändrats.

Förare: ${driverId}
Typ: ${type}
Ny tid: ${time}

Pass-ID: ${session.id}`;
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
await setPendingAction({
  sender,
  driverId: driver.driver_id,
  action: 'awaiting_checkin_location'
});

return `📍 Skicka din aktuella plats för att slutföra incheckningen.

Du måste vara inom en godkänd arbetsplats.`;
}


if (normalized === 'ut' || normalized === 'out') {
  const driver = await getDriverByPhone(sender);

  if (!driver) {
    return '❌ Ditt telefonnummer är inte registrerat. Kontakta administratören.';
  }

  await setPendingAction({
    sender,
    driverId: driver.driver_id,
    action: 'awaiting_checkout_location'
  });

  return `📍 Skicka din aktuella plats för att slutföra utcheckningen.

Du måste vara inom en godkänd arbetsplats.`;
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
if (/^plats\s+lägg\s+till\b/i.test(normalized)) {
  const adminAllowed = await isAdmin(sender);

  if (!adminAllowed) {
    return '❌ Endast administratören kan lägga till platser.';
  }

  const match = text.trim().match(
    /^plats\s+lägg\s+till\s+(.+?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(\d+)$/i
  );

  if (!match) {
    return `Använd:

PLATS LÄGG TILL Terminal Helsingborg 56.041706 12.709762 25`;
  }

  const name = match[1].trim();
  const latitude = Number(match[2]);
  const longitude = Number(match[3]);
  const radiusMeters = Number(match[4]);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    !Number.isInteger(radiusMeters) ||
    radiusMeters < 5 ||
    radiusMeters > 1000
  ) {
    return '❌ Kontrollera koordinaterna och radien. Radien måste vara 5–1000 meter.';
  }

  const location = await addAllowedLocation({
    name,
    latitude,
    longitude,
    radiusMeters
  });

  return `✅ Tillåten plats sparad.

Namn: ${location.name}
Latitud: ${location.latitude}
Longitud: ${location.longitude}
Radie: ${location.radius_meters} meter`;
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
if (
  normalized === 'hjälp' ||
  normalized === 'hjalp' ||
  normalized === 'help'
) {
  return `📋 TransBemanning Bot – Kommandon

👷 Förare:
IN – Checka in
UT – Checka ut
JA / NEJ – Svara på rastfrågan
15 / 30 / 45 – Ange rasttid
GPS – Skicka din position

👨‍💼 Admin:
REG 1001 0700000000 ABC123 – Registrera förare
LISTA – Visa alla förare
AKTIVA – Visa incheckade förare
RAPPORT 1001 2026-07 – Månadsrapport
ADMIN RAPPORT 2026-07 – Alla förares timmar
PDF 1001 2026-07 – Skicka PDF-rapport

HJÄLP – Visa denna lista`;
}
if (normalized === 'status') {
  const adminAllowed = await isAdmin(sender);

  if (!adminAllowed) {
    return '❌ Endast administratören kan använda STATUS.';
  }

  const drivers = await getAllDrivers();
  const activeSessions = await getActiveSessions();

  const now = new Date().toLocaleString('sv-SE', {
    timeZone: 'Europe/Stockholm'
  });

  return `🟢 TransBemanning Bot

✅ Server: Online
✅ Databas: Ansluten
✅ WhatsApp: Ansluten

👷 Registrerade förare: ${drivers.length}
🟢 Aktiva pass: ${activeSessions.length}

🕒 Senast uppdaterad:
${now}`;
}
if (/^avreg\b/i.test(normalized)) {
  const adminAllowed = await isAdmin(sender);

  if (!adminAllowed) {
    return '❌ Endast administratören kan använda AVREG.';
  }

  const parts = text.trim().split(/\s+/);
  const driverId = parts[1];

  if (!driverId) {
    return 'Använd: AVREG 1001';
  }

  const result = await permanentlyDeleteDriver(driverId);

  if (result.notFound) {
    return `❌ Förare ${driverId} hittades inte.`;
  }

  if (result.hasOpenSession) {
    return `❌ Föraren är fortfarande incheckad.

ID: ${driverId}
Namn: ${result.driver?.name || 'Saknas'}

Be föraren checka ut först eller använd ÄNDRA för att avsluta arbetspasset.`;
  }

  return `✅ Förare borttagen permanent.

ID: ${result.driver.driver_id}
Namn: ${result.driver.name || 'Saknas'}
Telefon: ${result.driver.phone || 'Saknas'}

All tillhörande information har raderats från systemet.`;
}
if (normalized === 'aktiva') {
  const adminAllowed = await isAdmin(sender);

  if (!adminAllowed) {
    return '❌ Endast administratören kan använda AKTIVA.';
  }

  const activeSessions = await getActiveSessions();

  if (!activeSessions.length) {
    return '✅ Inga aktiva förare.';
  }

  const now = new Date();

  const activeText = activeSessions
    .map((session, index) => {
      const checkInTime = new Date(session.check_in_at);

      const totalMinutes = Math.max(
        0,
        Math.floor((now.getTime() - checkInTime.getTime()) / 60000)
      );

      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;

      const swedishTime = checkInTime.toLocaleString('sv-SE', {
        timeZone: 'Europe/Stockholm'
      });

      return `${index + 1}. 👤 ID: ${session.driver_id}
🚚 Bil: ${session.vehicle_number || 'Saknas'}
🕒 Incheckad: ${swedishTime}
⏱️ Aktiv tid: ${hours} h ${String(minutes).padStart(2, '0')} min`;
    })
    .join('\n\n');

  return `🟢 Aktiva förare

${activeText}`;
}
if (/^ny\s+plats\b/i.test(normalized)) {
  const adminAllowed = await isAdmin(sender);

  if (!adminAllowed) {
    return '❌ Endast administratören kan lägga till arbetsplatser.';
  }

  const match = text.trim().match(
    /^ny\s+plats\s+(.+?)(?:\s+(\d+))?$/i
  );

  if (!match) {
    return `Använd:

NY PLATS Helsingborg Terminal

eller:

NY PLATS Helsingborg Terminal 150`;
  }

  const name = match[1].trim();
  const radiusMeters = match[2] ? Number(match[2]) : 150;

  if (
    !Number.isInteger(radiusMeters) ||
    radiusMeters < 5 ||
    radiusMeters > 1000
  ) {
    return '❌ Radien måste vara mellan 5 och 1000 meter.';
  }

  await setPendingAction({
    sender,
    driverId: null,
    action: 'awaiting_new_allowed_location',
    metadata: {
      name,
      radiusMeters
    }
  });

  return `📍 Skicka din aktuella plats för att registrera:

${name}

Radie: ${radiusMeters} meter`;
}
if (normalized === 'platser') {
  const adminAllowed = await isAdmin(sender);

  if (!adminAllowed) {
    return '❌ Endast administratören kan se arbetsplatser.';
  }

  const locations = await getAllowedLocations();

  if (!locations.length) {
    return 'ℹ️ Det finns inga registrerade arbetsplatser.';
  }

  const locationList = locations
    .map((location, index) => {
      return `${index + 1}. ${location.name}
Radie: ${location.radius_meters} meter
Latitud: ${location.latitude}
Longitud: ${location.longitude}`;
    })
    .join('\n\n');

  return `📍 Registrerade arbetsplatser: ${locations.length}

${locationList}`;
}
if (/^ta\s+bort\s+plats\b/i.test(normalized)) {
  const adminAllowed = await isAdmin(sender);

  if (!adminAllowed) {
    return '❌ Endast administratören kan ta bort arbetsplatser.';
  }

  const match = text.trim().match(/^ta\s+bort\s+plats\s+(.+)$/i);

  if (!match) {
    return `Använd:

TA BORT PLATS Helsingborg Terminal`;
  }

  const name = match[1].trim();

  const location = await deactivateAllowedLocation(name);

  if (!location) {
    return `❌ Arbetsplatsen "${name}" hittades inte eller är redan borttagen.`;
  }

  return `✅ Arbetsplats borttagen.

Namn: ${location.name}`;
}
if (/^lägg\s+till\s+admin\b/i.test(text.trim())) {
  if (!(await isAdmin(sender))) {
    return '❌ Endast administratörer kan lägga till nya administratörer.';
  }

  const match = text.trim().match(/^lägg\s+till\s+admin\s+(\d+)$/i);

  if (!match) {
    return `Använd:

LÄGG TILL ADMIN 46701234567`;
  }

  const phone = match[1];

  await addAdmin(phone);

  return `✅ Administratör tillagd.

Telefon: ${phone}`;
}
if (/^ta\s+bort\s+admin\b/i.test(text.trim())) {
  if (!(await isAdmin(sender))) {
    return '❌ Endast administratörer kan ta bort administratörer.';
  }

  const match = text.trim().match(/^ta\s+bort\s+admin\s+(\d+)$/i);

  if (!match) {
    return `Använd:

TA BORT ADMIN 46701234567`;
  }

  const phone = match[1];

  if (phone === process.env.ADMIN_PHONE?.replace(/\D/g, '')) {
    return '❌ Huvudadministratören kan inte tas bort.';
  }

  const removed = await removeAdmin(phone);

  if (!removed) {
    return '❌ Administratören hittades inte.';
  }

  return `✅ Administratören har tagits bort.

Telefon: ${phone}`;
}
if (text.trim().toLowerCase() === 'adminlista') {
  if (!(await isAdmin(sender))) {
    return '❌ Endast administratörer kan se adminlistan.';
  }

  const admins = await listAdmins();

  if (!admins.length) {
    return 'ℹ️ Det finns inga aktiva administratörer.';
  }

  const adminList = admins
    .map((admin, index) => {
      const name = admin.name ? ` – ${admin.name}` : '';
      return `${index + 1}. ${admin.phone}${name}`;
    })
    .join('\n');

  return `👑 Aktiva administratörer: ${admins.length}

${adminList}`;
}
if (/^meddelande\s+alla$/i.test(text.trim())) {
  if (!(await isAdmin(sender))) {
    return '❌ Endast administratörer kan använda detta kommando.';
  }

  await setPendingAction({
    sender,
    driverId: null,
    action: 'awaiting_broadcast_message'
  });

  return `📢 Skicka nu meddelandet som ska skickas till alla registrerade förare.

Skriv AVBRYT för att avbryta.`;
}
if (/^meddelande\s+(.+)$/i.test(text.trim())) {
  if (!(await isAdmin(sender))) {
    return '❌ Endast administratörer kan använda detta kommando.';
  }

  const match = text.trim().match(/^meddelande\s+(.+)$/i);
  const target = match[1].trim();

  if (target.toLowerCase() === 'alla') {
    return '❌ Använd kommandot MEDDELANDE ALLA.';
  }

  const driver = await findDriver(target);

  if (!driver) {
    return `❌ Föraren "${target}" hittades inte.`;
  }

  await setPendingAction({
    sender,
    driverId: driver.driver_id,
    action: 'awaiting_private_message',
    metadata: {
      phone: driver.phone,
      name: driver.name,
      driverId: driver.driver_id
    }
  });

  return `✍️ Skriv meddelandet som ska skickas till:

${driver.driver_id} – ${driver.name}

Skriv AVBRYT för att avbryta.`;
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
router.post('/', (req, res) => {
  // Bekräfta direkt till Meta så meddelandet inte skickas igen
  res.sendStatus(200);

  const processWebhook = async () => {
    const entries = req.body.entry || [];

    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        const contacts = value.contacts || [];
        const messages = value.messages || [];

        for (const message of messages) {
          const contact =
            contacts.find((item) => item.wa_id === message.from) ||
            contacts[0] ||
            {};

          try {
            const replyText = await handleIncomingMessage(
              message,
              contact
            );

            if (replyText && message.from) {
              await sendWhatsAppText(
                message.from,
                replyText
              );
            }
          } catch (error) {
            console.error(
              'Webhook processing error:',
              error.response?.data || error.message || error
            );
          }
        }
      }
    }
  };

  processWebhook().catch((error) => {
    console.error(
      'Webhook background error:',
      error.response?.data || error.message || error
    );
  });
});

module.exports = router;
