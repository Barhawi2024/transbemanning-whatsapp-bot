const { getCompanyMonthlyReport } = require('../database');

function buildReport({ messages = [], drivers = [] }) {
  return {
    messageCount: messages.length,
    driverCount: drivers.length,
    messages,
    drivers,
    generatedAt: new Date().toISOString()
  };
}

async function buildMonthlyCompanyReport(year, month) {
  const report = await getCompanyMonthlyReport(year, month);
  const drivers = Array.isArray(report.drivers) ? report.drivers : [];

  if (!drivers.length) {
    return `📊 ADMIN RAPPORT ${year}-${String(month).padStart(2, '0')}

Inga arbetspass registrerade.`;
  }

  const driverText = drivers
    .map((driver) => {
      const name = driver.name || 'Okänd förare';
      const driverId = driver.driver_id || '-';
      const closedSessions = Number(driver.closed_sessions || 0);
      const openSessions = Number(driver.open_sessions || 0);
      const totalText = driver.totalText || '0 h 00 min';

      return `${driverId} – ${name}
Avslutade pass: ${closedSessions}
Pågående pass: ${openSessions}
Arbetstid: ${totalText}`;
    })
    .join('\n\n');

  return `📊 ADMIN RAPPORT ${year}-${String(month).padStart(2, '0')}

${driverText}

────────────
Total arbetstid för företaget:
${report.companyTotalText || '0 h 00 min'}`;
}

module.exports = {
  buildReport,
  buildMonthlyCompanyReport
};
