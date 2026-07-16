require('dotenv').config();

const express = require('express');

const webhookRoutes = require('./routes/webhook');
const { setupDatabase } = require('./database');
const {
  startMonthlyReportJob,
  sendMonthlyReportEmail
} = require("./jobs/monthlyReport");
const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json({ limit: '10mb' }));

app.get('/', (req, res) => {
  res.status(200).send('TransBemanning WhatsApp Bot is running');
});

app.use('/webhook', webhookRoutes);

async function startServer() {
  try {
 await setupDatabase();


app.listen(PORT, () => {
    console.log(`✅ Server listening on port ${PORT}`);
    startMonthlyReportJob();
});
  } catch (error) {
    console.error('❌ Kunde inte starta servern:', error);
    process.exit(1);
  }
}

startServer();
