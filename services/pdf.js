const PDFDocument = require('pdfkit');

function formatDateTime(value) {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString('sv-SE', {
    timeZone: 'Europe/Stockholm',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function minutesToText(totalMinutes) {
  const safeMinutes = Math.max(0, Number(totalMinutes) || 0);
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;

  return `${hours} h ${String(minutes).padStart(2, '0')} min`;
}

async function generatePdfReport(report) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50
    });

    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const driverName =
      report.driver?.name ||
      report.driver?.driver_id ||
      '-';

    const driverId =
      report.driver?.driver_id ||
      '-';

    const month = `${report.year}-${String(report.month).padStart(2, '0')}`;

    doc
      .fontSize(18)
      .text('TransBemanning AB', {
        align: 'center'
      });

    doc
      .fontSize(15)
      .text('Månadsrapport', {
        align: 'center'
      });

    doc.moveDown();

    doc
      .fontSize(11)
      .text(`Förare: ${driverName}`)
      .text(`ID: ${driverId}`)
      .text(`Månad: ${month}`)
      .text(`Total arbetstid: ${report.totals?.totalText || '0 h 00 min'}`);

    doc.moveDown();

    const sessions = Array.isArray(report.sessions)
      ? report.sessions
      : [];

    if (!sessions.length) {
      doc.text('Inga arbetspass registrerade för denna månad.');
      doc.end();
      return;
    }

    sessions.forEach((session, index) => {
      const checkIn = formatDateTime(session.check_in_at);
      const checkOut = session.check_out_at
        ? formatDateTime(session.check_out_at)
        : 'Pågående';

      const breakMinutes = Number(session.break_minutes || 0);
      const workedMinutes = Number(session.worked_minutes || 0);

      doc
        .fontSize(12)
        .text(`${index + 1}. Arbetspass`, {
          underline: true
        });

      doc
        .fontSize(10)
        .text(`IN: ${checkIn}`)
        .text(`UT: ${checkOut}`)
        .text(`Rast: ${breakMinutes} min`)
        .text(`Arbetstid: ${minutesToText(workedMinutes)}`);

      doc.moveDown();
    });

    doc.end();
  });
}

module.exports = {
  generatePdfReport
};
