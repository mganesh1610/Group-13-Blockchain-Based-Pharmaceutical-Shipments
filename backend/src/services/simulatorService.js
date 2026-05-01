const { saveLogBuffer } = require("./logService");

const scenarioProfiles = {
  normal: [3.4, 3.9, 4.2, 4.8, 5.1, 5.5, 5.9, 6.2, 6.5, 6.9, 7.2, 7.6],
  mild_breach: [3.6, 4.1, 4.7, 5.3, 6.4, 7.1, 8.4, 8.9, 7.6, 6.2, 5.4, 4.8],
  severe_breach: [3.5, 4.0, 4.8, 6.2, 8.6, 10.1, 11.7, 12.3, 9.4, 7.1, 5.8, 4.6]
};

function buildReadings(batchId, scenario, count) {
  const temps = scenarioProfiles[scenario] || scenarioProfiles.normal;
  const start = Date.now() - count * 15 * 60 * 1000;

  return Array.from({ length: count }, (_, index) => ({
    time: new Date(start + index * 15 * 60 * 1000).toISOString(),
    tempC: temps[index % temps.length],
    humidity: 58 + (index % 6),
    gps: index < count / 2 ? "Phoenix, AZ" : "Tempe, AZ",
    batchId
  }));
}

async function simulateLog({ batchId = "BATCH001", scenario = "normal", readingCount = 12 }) {
  const normalizedScenario = scenarioProfiles[scenario] ? scenario : "normal";
  const normalizedCount = Math.max(1, Math.min(Number(readingCount) || 12, 96));

  const payload = {
    batchId,
    sensorId: `TEMP-${normalizedScenario.toUpperCase().replace(/[^A-Z0-9]/g, "-")}`,
    scenario: normalizedScenario,
    generatedAt: new Date().toISOString(),
    safeRangeC: { min: 2, max: 8 },
    readings: buildReadings(batchId, normalizedScenario, normalizedCount)
  };

  return saveLogBuffer({
    buffer: Buffer.from(JSON.stringify(payload, null, 2)),
    originalName: `${batchId}-${normalizedScenario}.json`,
    batchId,
    scenario: normalizedScenario,
    source: "simulation"
  });
}

module.exports = {
  simulateLog,
  scenarioProfiles
};
