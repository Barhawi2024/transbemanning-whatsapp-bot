const cron = require("node-cron");
const nodemailer = require("nodemailer");

const {
  getCompanyMonthlyReport
} = require("../database");

function getPreviousMonth() {
  const now = new Date();

  const previousMonthDate = new Date(
    now.getFullYear(),
    now.getMonth() - 1,
    1
  );

  return {
    year: previousMonthDate.getFullYear(),
    month: previousMonthDate.getMonth() + 1
  };
}

function formatReportText(report, year, month) {
  const drivers = Array.isArray(report.drivers)
    ? report.drivers
    : [];

  const monthText = `${year}-${String(month).padStart(2, "0")}`;

  const driverText = drivers.length
    ? drivers
        .map((driver) => {
          return `${driver.driver_id} – ${driver.name || "Okänd förare"}
Avslutade pass: ${Number(driver.closed_sessions || 0)}
Pågående pass: ${Number(driver.open_sessions || 0)}
Arbetstid: ${driver.totalText || "0 h 00 min"}`;
        })
        .join("\n\n")
    : "Inga arbetspass registrerade.";

  return `TransBemanning AB – Månadsrapport ${monthText}

${driverText}

Total arbetstid för företaget:
${report.companyTotalText || "0 h 00 min"}`;
}

async function sendMonthlyReportEmail() {
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASSWORD,
    REPORT_EMAIL
  } = process.env;

  if (
    !SMTP_HOST ||
    !SMTP_PORT ||
    !SMTP_USER ||
    !SMTP_PASSWORD ||
    !REPORT_EMAIL
  ) {
    throw new Error("SMTP-inställningar eller REPORT_EMAIL saknas.");
  }

  const { year, month } = getPreviousMonth();
  const monthText = `${year}-${String(month).padStart(2, "0")}`;

  const report = await getCompanyMonthlyReport(year, month);
  const reportText = formatReportText(report, year, month);

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASSWORD
    }
  });

  await transporter.sendMail({
    from: `"TransBemanning AB" <${SMTP_USER}>`,
    to: REPORT_EMAIL,
    subject: `TransBemanning – Månadsrapport ${monthText}`,
    text: reportText
  });

  console.log(
    `✅ Månadsrapport ${monthText} skickad till ${REPORT_EMAIL}`
  );
}

function startMonthlyReportJob() {
  cron.schedule(
    "5 0 1 * *",
    async () => {
      try {
        console.log("📊 Startar automatisk månadsrapport...");
        await sendMonthlyReportEmail();
      } catch (error) {
        console.error(
          "❌ Kunde inte skicka månadsrapport:",
          error.message
        );
      }
    },
    {
      timezone: "Europe/Stockholm"
    }
  );

  console.log(
    "✅ Automatisk månadsrapport schemalagd till den 1:a kl. 00:05"
  );
}

module.exports = {
  startMonthlyReportJob,
  sendMonthlyReportEmail
};
