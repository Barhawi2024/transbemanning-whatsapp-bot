function buildReport({ messages = [], drivers = [] }) {
  return {
    messageCount: messages.length,
    driverCount: drivers.length,
    messages,
    drivers,
    generatedAt: new Date().toISOString()
  };
}

module.exports = {
  buildReport
};
