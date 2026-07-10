const ExcelJS = require('exceljs');

async function generateExcelReport(report) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Report');

  worksheet.columns = [
    { header: 'Message Count', key: 'messageCount', width: 20 },
    { header: 'Driver Count', key: 'driverCount', width: 20 },
    { header: 'Generated At', key: 'generatedAt', width: 30 }
  ];

  worksheet.addRow({
    messageCount: report.messageCount,
    driverCount: report.driverCount,
    generatedAt: report.generatedAt
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

module.exports = {
  generateExcelReport
};
