const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { saveMessage, listMessages, listDrivers, saveActivity } = require('../database');
const { registerDriver } = require('../services/driver');
const { buildReport } = require('../services/report');
const { generatePdfReport } = require('../services/pdf');
const { generateExcelReport } = require('../services/excel');
const { distanceBetweenPoints } = require('../services/gps');

const router = express.Router();
async function handleIncomingMessage

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
  const sender = contact?.wa_id || message.from || 'unknown';

  const savedMessage = await saveMessage({
    sender,
    type: message.type,
    body: text
  });

  if (!text) {
    return 'Received an empty message.';
  }
const swedishTime = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Stockholm',
  hour: '2-digit',
  minute: '2-digit',
}).format(new Date());

if (normalized === 'in') {
  await saveActivity({
    sender,
    action: 'check-in',
    body: text,
  });

  return `✅ Incheckning registrerad.\nTid: ${swedishTime}\nHa en bra arbetsdag!`;
}

if (normalized === 'ut') {
  await saveActivity({
    sender,
    action: 'check-out',
    body: text,
  });

  return `✅ Utcheckning registrerad.\nTid: ${swedishTime}`;
}
  if (normalized.includes('driver')) {
    const parts = text.split(/\s+/);
    const name = parts[1] || 'Driver';
    const phone = parts[2] || sender;
    const vehicleNumber = parts[3] || 'N/A';
    await registerDriver({ name, phone, vehicleNumber });
    await saveActivity({ sender, action: 'register-driver', body: text });
    return `Driver registered: ${name} (${phone})`;
  }

  if (normalized.includes('report')) {
    const messages = await listMessages();
    const drivers = await listDrivers();
    const report = buildReport({ messages, drivers });
    await saveActivity({ sender, action: 'generate-report', body: text });
    return `Report ready. Messages: ${report.messageCount}. Drivers: ${report.driverCount}.`;
  }

  if (normalized.includes('pdf')) {
    const messages = await listMessages();
    const drivers = await listDrivers();
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
    const drivers = await listDrivers();
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

  await saveActivity({ sender, action: 'echo', body: text });
  return `You said: ${text}`;
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
