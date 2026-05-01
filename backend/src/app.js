require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { corsOrigins } = require("./config");
const logsRouter = require("./routes/logs");
const { ensureUploadDir, getLogsForBatch } = require("./services/logService");

const app = express();

ensureUploadDir().catch((error) => {
  console.error("Failed to initialize upload directory:", error);
});

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || corsOrigins().includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("CORS origin not allowed"));
    }
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "cold-chain-iot-log-api",
    timestamp: new Date().toISOString()
  });
});

app.use("/api/logs", logsRouter);

app.get("/api/batches/:batchId/offchain-summary", async (req, res, next) => {
  try {
    const logs = await getLogsForBatch(req.params.batchId);
    const breachCount = logs.filter((log) => log.breachFlag).length;

    res.json({
      batchId: req.params.batchId,
      logCount: logs.length,
      breachCount,
      logs
    });
  } catch (error) {
    next(error);
  }
});

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use((error, req, res, next) => {
  const statusCode = error.statusCode || 500;
  res.status(statusCode).json({
    message: error.message || "Unexpected server error"
  });
});

module.exports = app;
