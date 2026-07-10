const PDFDocument = require('pdfkit');

async function generatePdfReport(report) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(16).text('TransBemanning Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Messages: ${report.messageCount}`);
    doc.text(`Drivers: ${report.driverCount}`);
    doc.text(`Generated: ${report.generatedAt}`);
    doc.end();
  });
}

module.exports = {
  generatePdfReport
};
