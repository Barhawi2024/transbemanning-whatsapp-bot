const express = require('express');
const dotenv = require('dotenv');
const webhookRoutes = require('./routes/webhook');
const { initDatabase } = require('./database');

dotenv.config();

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'TransBemanning WhatsApp bot is running' });
});

app.use('/webhook', webhookRoutes);

const port = process.env.PORT || 3000;

(async () => {
  try {
    await initDatabase();
    app.listen(port, () => {
      console.log(`Server listening on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to start server', error);
    process.exit(1);
  }
})();

module.exports = app;
