const PDFDocument = require('pdfkit');
const {
  getDriverMonthlyReport,
  getCompanyMonthlyReport,
  minutesToHoursText
} = require('./reports');

function monthName(month) {
  const months = [
    'Januari',
    'Februari',
    'Mars',
    'April',
    'Maj',
    'Juni',
    'Juli',
    'Augusti',
    'September',
    'Oktober',
    'November',
    'December'
  ];

  return months[Number(month) - 1] || month;
}

function createPdf(build) {
  return new Promise((resolve, reject) => {

    const doc = new PDFDocument({
      margin: 40,
      size: 'A4'
    });

    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));

    doc.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    doc.on('error', reject);

    build(doc);

    doc.end();

  });
}

async function createDriverReportPdf(driverId, year, month) {

  const report = await getDriverMonthlyReport(
    driverId,
    year,
    month
  );

  return createPdf(doc => {

    doc.fontSize(18)
      .text("TransBemanning AB");

    doc.moveDown();

    doc.fontSize(15)
      .text(
        `Månadsrapport ${monthName(month)} ${year}`
      );

    doc.moveDown();

    doc.fontSize(11);

    doc.text(`Förare: ${report.driver?.name || '-'}`);
    doc.text(`ID: ${driverId}`);
    doc.text(`Telefon: ${report.driver?.phone || '-'}`);
    doc.text(`Bil: ${report.driver?.vehicle_number || '-'}`);

    doc.moveDown();

    doc.text(
      `Totalt arbetat: ${report.totals.totalText}`
    );

    doc.text(
      `Pass: ${report.totals.closedSessions}`
    );

    doc.moveDown();

    report.sessions.forEach(session => {

      const inTime =
        new Date(session.check_in_at)
          .toLocaleString("sv-SE");

      const outTime =
        session.check_out_at
          ? new Date(session.check_out_at)
              .toLocaleString("sv-SE")
          : "Pågående";

      doc.text(
        `${inTime} → ${outTime}`
      );

      doc.text(
        `Arbetstid: ${minutesToHoursText(
          session.worked_minutes || 0
        )}`
      );

      doc.moveDown(0.5);

    });

  });

}

async function createCompanyReportPdf(
  year,
  month
) {

  const report =
    await getCompanyMonthlyReport(
      year,
      month
    );

  return createPdf(doc => {

    doc.fontSize(18)
      .text("TransBemanning AB");

    doc.moveDown();

    doc.fontSize(15)
      .text(
        `Företagsrapport ${monthName(month)} ${year}`
      );

    doc.moveDown();

    doc.text(
      `Totalt: ${report.companyTotalText}`
    );

    doc.moveDown();

    report.drivers.forEach(driver => {

      doc.text(
        `${driver.driver_id} - ${driver.name}`
      );

      doc.text(
        `Tid: ${driver.totalText}`
      );

      doc.text(
        `Pass: ${driver.closed_sessions}`
      );

      doc.moveDown(0.5);

    });

  });

}

module.exports = {
  createDriverReportPdf,
  createCompanyReportPdf
};
