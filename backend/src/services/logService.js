const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const { uploadDir, safeTempMinC, safeTempMaxC } = require("../config");
const { hashBuffer, hashFile } = require("../utils/hash");
const azureBlobLogStore = require("./azureBlobLogStore");
const azureSqlLogStore = require("./azureSqlLogStore");

const metadataFile = path.join(uploadDir, "metadata.json");

async function ensureUploadDir() {
  if (azureBlobLogStore.isEnabled()) {
    await azureBlobLogStore.ensureContainer();
  }

  if (azureSqlLogStore.isEnabled()) {
    await azureSqlLogStore.ensureSchema();
    return;
  }

  await fs.mkdir(uploadDir, { recursive: true });
}

function sanitizeName(value, fallback = "log") {
  const safe = String(value || fallback)
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return safe || fallback;
}

function extensionFor(originalName, buffer) {
  const ext = path.extname(originalName || "").toLowerCase();

  if (ext === ".json" || ext === ".csv") {
    return ext;
  }

  const text = buffer.toString("utf8").trim();
  return text.startsWith("{") || text.startsWith("[") ? ".json" : ".csv";
}

function parseJsonReadings(text) {
  const payload = JSON.parse(text);
  const readings = Array.isArray(payload) ? payload : payload.readings;
  return Array.isArray(readings) ? readings : [];
}

function parseCsvReadings(text) {
  const [headerLine, ...rows] = text.trim().split(/\r?\n/);
  if (!headerLine) {
    return [];
  }

  const headers = headerLine.split(",").map((header) => header.trim());

  return rows
    .filter(Boolean)
    .map((row) => {
      const columns = row.split(",").map((column) => column.trim());
      return headers.reduce((record, header, index) => {
        const rawValue = columns[index] || "";
        record[header] = header.toLowerCase().includes("temp") ? Number(rawValue) : rawValue;
        return record;
      }, {});
    });
}

function analyzeBuffer(buffer, filename) {
  const text = buffer.toString("utf8");
  const ext = path.extname(filename || "").toLowerCase();

  let readings = [];
  try {
    readings = ext === ".csv" ? parseCsvReadings(text) : parseJsonReadings(text);
  } catch (error) {
    readings = [];
  }

  const temperatures = readings
    .map((reading) => Number(reading.tempC ?? reading.temperatureC ?? reading.temperature ?? reading.temp))
    .filter((value) => Number.isFinite(value));

  const readingCount = readings.length;
  const minTemp = temperatures.length ? Math.min(...temperatures) : null;
  const maxTemp = temperatures.length ? Math.max(...temperatures) : null;
  const breachFlag = temperatures.some((tempC) => tempC < safeTempMinC || tempC > safeTempMaxC);

  const summary =
    readingCount === 0 || minTemp === null || maxTemp === null
      ? "No parseable temperature readings found"
      : `${readingCount} readings, min ${minTemp.toFixed(1)}C, max ${maxTemp.toFixed(1)}C, ${
          breachFlag ? "breach detected" : "compliant"
        }`;

  return {
    readingCount,
    minTemp,
    maxTemp,
    breachFlag,
    summary
  };
}

async function readMetadata() {
  try {
    const content = await fs.readFile(metadataFile, "utf8");
    return JSON.parse(content);
  } catch (error) {
    return [];
  }
}

async function writeMetadata(records) {
  await ensureUploadDir();
  await fs.writeFile(metadataFile, JSON.stringify(records, null, 2));
}

async function appendMetadata(record) {
  const records = await readMetadata();
  records.push(record);
  await writeMetadata(records);
}

async function saveLogBuffer({ buffer, originalName, batchId, scenario = "upload", source = "upload" }) {
  if (!azureSqlLogStore.isEnabled()) {
    await ensureUploadDir();
  }

  const safeBatchId = sanitizeName(batchId, "batch");
  const safeScenario = sanitizeName(scenario, "log");
  const ext = extensionFor(originalName, buffer);
  const filename = `${safeBatchId}-${safeScenario}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`;

  const logHash = hashBuffer(buffer);
  const analysis = analyzeBuffer(buffer, filename);
  const logURI = `/api/logs/${filename}`;
  const contentType = ext === ".json" ? "application/json" : "text/csv";

  const response = {
    filename,
    logURI,
    logHash,
    breachFlag: analysis.breachFlag,
    summary: analysis.summary,
    readingCount: analysis.readingCount,
    minTemp: analysis.minTemp,
    maxTemp: analysis.maxTemp
  };

  const metadataRecord = {
    ...response,
    batchId: batchId || null,
    scenario,
    source,
    savedAt: new Date().toISOString(),
    storageProvider: azureBlobLogStore.isEnabled() ? "azure-blob" : azureSqlLogStore.isEnabled() ? "azure-sql" : "local"
  };

  if (azureBlobLogStore.isEnabled()) {
    const blobInfo = await azureBlobLogStore.uploadLogFile(filename, buffer, contentType);
    metadataRecord.blobName = blobInfo.blobName;
    metadataRecord.blobUrl = blobInfo.blobUrl;
  }

  if (azureSqlLogStore.isEnabled()) {
    await azureSqlLogStore.saveLogRecord(metadataRecord, azureBlobLogStore.isEnabled() ? null : buffer, contentType);
  } else {
    if (!azureBlobLogStore.isEnabled()) {
      const filePath = path.join(uploadDir, filename);
      await fs.writeFile(filePath, buffer);
    }
    await appendMetadata(metadataRecord);
  }

  return response;
}

async function verifyLog({ buffer, filename, expectedHash }) {
  if (!expectedHash) {
    const error = new Error("expectedHash is required");
    error.statusCode = 400;
    throw error;
  }

  let sourceBuffer = buffer;

  if (!sourceBuffer) {
    await ensureUploadDir();

    if (!filename) {
      const error = new Error("Provide either a file or filename");
      error.statusCode = 400;
      throw error;
    }

    const file = await getLogFile(filename);
    sourceBuffer = file.buffer;
  }

  const recomputedHash = hashBuffer(sourceBuffer);
  const isMatch = recomputedHash.toLowerCase() === expectedHash.toLowerCase();

  return {
    recomputedHash,
    expectedHash,
    isMatch,
    message: isMatch ? "MATCH: off-chain file matches the anchored digest" : "MISMATCH: file has changed or is not the anchored log"
  };
}

async function getLogsForBatch(batchId) {
  if (azureSqlLogStore.isEnabled()) {
    return azureSqlLogStore.getLogsForBatch(batchId);
  }

  const records = await readMetadata();
  return records.filter((record) => record.batchId === batchId);
}

async function getLogFile(filename) {
  const safeFilename = path.basename(filename);

  if (azureBlobLogStore.isEnabled()) {
    try {
      return await azureBlobLogStore.readLogFile(safeFilename);
    } catch (error) {
      if (!azureSqlLogStore.isEnabled() || error.statusCode !== 404) {
        throw error;
      }
    }
  }

  if (azureSqlLogStore.isEnabled()) {
    return azureSqlLogStore.readLogFile(safeFilename);
  }

  const filePath = path.join(uploadDir, safeFilename);
  let buffer;

  try {
    buffer = await fs.readFile(filePath);
  } catch (error) {
    if (error.code === "ENOENT") {
      const notFound = new Error("Log file not found");
      notFound.statusCode = 404;
      throw notFound;
    }

    throw error;
  }

  const ext = path.extname(safeFilename).toLowerCase();

  return {
    filename: safeFilename,
    buffer,
    contentType: ext === ".json" ? "application/json" : ext === ".csv" ? "text/csv" : "application/octet-stream"
  };
}

module.exports = {
  ensureUploadDir,
  saveLogBuffer,
  verifyLog,
  getLogsForBatch,
  getLogFile,
  hashFile,
  uploadDir
};
