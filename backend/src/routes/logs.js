const path = require("path");
const express = require("express");
const multer = require("multer");
const { getLogFile, saveLogBuffer, verifyLog } = require("../services/logService");
const { simulateLog } = require("../services/simulatorService");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024
  }
});

router.post("/upload", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "IoT log file is required" });
    }

    const result = await saveLogBuffer({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      batchId: req.body.batchId,
      scenario: req.body.scenario || "upload",
      source: "upload"
    });

    return res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
});

router.post("/simulate", async (req, res, next) => {
  try {
    const result = await simulateLog({
      batchId: req.body.batchId,
      scenario: req.body.scenario,
      readingCount: req.body.readingCount
    });

    return res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
});

router.post("/verify", upload.single("file"), async (req, res, next) => {
  try {
    const result = await verifyLog({
      buffer: req.file ? req.file.buffer : null,
      filename: req.body.filename,
      expectedHash: req.body.expectedHash
    });

    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

router.get("/:filename", async (req, res, next) => {
  const safeFilename = path.basename(req.params.filename);

  try {
    const file = await getLogFile(safeFilename);
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Content-Disposition", `inline; filename="${file.filename}"`);
    return res.send(file.buffer);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
