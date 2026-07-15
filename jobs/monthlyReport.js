const cron = require("node-cron");

function startMonthlyReportJob() {
    cron.schedule("5 0 1 * *", async () => {
        console.log("📊 Startar automatisk månadsrapport...");
    }, {
        timezone: "Europe/Stockholm"
    });
}

module.exports = {
    startMonthlyReportJob
};
