const sql = require("mssql");
const { azureSql } = require("../config");

let poolPromise = null;
let schemaReady = false;

function isEnabled() {
  return azureSql.enabled;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isResumeOrTransientError(error) {
  const message = String(error?.message || "").toLowerCase();
  const number = Number(error?.number || error?.originalError?.number || 0);

  return (
    number === 40613 ||
    error?.code === "ETIMEOUT" ||
    error?.code === "ESOCKET" ||
    message.includes("40613") ||
    message.includes("not currently available") ||
    message.includes("database is unavailable") ||
    message.includes("resuming") ||
    message.includes("paused")
  );
}

function resetPool() {
  poolPromise = null;
  schemaReady = false;
}

async function withAzureSqlRetry(operation) {
  let lastError;

  for (let attempt = 1; attempt <= azureSql.retryAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isResumeOrTransientError(error) || attempt === azureSql.retryAttempts) {
        throw error;
      }

      resetPool();
      const delayMs = azureSql.retryBaseDelayMs * attempt;
      await sleep(delayMs);
    }
  }

  throw lastError;
}

async function getPool() {
  if (!isEnabled()) {
    throw new Error("Azure SQL is not configured");
  }

  if (!poolPromise) {
    poolPromise = sql
      .connect({
        server: azureSql.server,
        database: azureSql.database,
        user: azureSql.user,
        password: azureSql.password,
        port: azureSql.port,
        options: azureSql.options,
        pool: {
          max: 5,
          min: 0,
          idleTimeoutMillis: 30000
        },
        connectionTimeout: 30000,
        requestTimeout: 30000
      })
      .catch((error) => {
        resetPool();
        throw error;
      });
  }

  return poolPromise;
}

async function ensureSchema() {
  if (!isEnabled() || schemaReady) {
    return;
  }

  await withAzureSqlRetry(async () => {
    const pool = await getPool();
    await pool.request().batch(`
      IF OBJECT_ID('dbo.IotLogs', 'U') IS NULL
      BEGIN
        CREATE TABLE dbo.IotLogs (
          id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
          filename NVARCHAR(260) NOT NULL UNIQUE,
          batchId NVARCHAR(100) NULL,
          scenario NVARCHAR(80) NULL,
          source NVARCHAR(80) NOT NULL,
          logURI NVARCHAR(500) NOT NULL,
          logHash NVARCHAR(80) NOT NULL,
          breachFlag BIT NOT NULL,
          summary NVARCHAR(1000) NOT NULL,
          readingCount INT NULL,
          minTemp FLOAT NULL,
          maxTemp FLOAT NULL,
          content VARBINARY(MAX) NULL,
          contentType NVARCHAR(80) NOT NULL,
          storageProvider NVARCHAR(40) NOT NULL DEFAULT 'azure-sql',
          blobName NVARCHAR(260) NULL,
          blobUrl NVARCHAR(1000) NULL,
          savedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
        );
      END;
    `);

    await pool.request().batch(`
      IF COL_LENGTH('dbo.IotLogs', 'storageProvider') IS NULL
      BEGIN
        EXEC('ALTER TABLE dbo.IotLogs ADD storageProvider NVARCHAR(40) NOT NULL CONSTRAINT DF_IotLogs_StorageProvider DEFAULT ''azure-sql''');
      END;

      IF COL_LENGTH('dbo.IotLogs', 'blobName') IS NULL
      BEGIN
        EXEC('ALTER TABLE dbo.IotLogs ADD blobName NVARCHAR(260) NULL');
      END;

      IF COL_LENGTH('dbo.IotLogs', 'blobUrl') IS NULL
      BEGIN
        EXEC('ALTER TABLE dbo.IotLogs ADD blobUrl NVARCHAR(1000) NULL');
      END;

      IF EXISTS (
        SELECT 1
        FROM sys.columns
        WHERE object_id = OBJECT_ID('dbo.IotLogs')
          AND name = 'content'
          AND is_nullable = 0
      )
      BEGIN
        ALTER TABLE dbo.IotLogs ALTER COLUMN content VARBINARY(MAX) NULL;
      END;
    `);

    await pool.request().batch(`
      IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = 'IX_IotLogs_BatchId_SavedAt' AND object_id = OBJECT_ID('dbo.IotLogs')
      )
      BEGIN
        CREATE INDEX IX_IotLogs_BatchId_SavedAt ON dbo.IotLogs(batchId, savedAt DESC);
      END;
    `);
  });

  schemaReady = true;
}

function mapRecord(row) {
  return {
    filename: row.filename,
    batchId: row.batchId,
    scenario: row.scenario,
    source: row.source,
    logURI: row.logURI,
    logHash: row.logHash,
    breachFlag: Boolean(row.breachFlag),
    summary: row.summary,
    readingCount: row.readingCount,
    minTemp: row.minTemp,
    maxTemp: row.maxTemp,
    storageProvider: row.storageProvider || "azure-sql",
    blobName: row.blobName,
    blobUrl: row.blobUrl,
    savedAt: row.savedAt instanceof Date ? row.savedAt.toISOString() : row.savedAt
  };
}

async function saveLogRecord(record, buffer, contentType) {
  await ensureSchema();

  await withAzureSqlRetry(async () => {
    const pool = await getPool();
    await pool
      .request()
      .input("filename", sql.NVarChar(260), record.filename)
      .input("batchId", sql.NVarChar(100), record.batchId)
      .input("scenario", sql.NVarChar(80), record.scenario)
      .input("source", sql.NVarChar(80), record.source)
      .input("logURI", sql.NVarChar(500), record.logURI)
      .input("logHash", sql.NVarChar(80), record.logHash)
      .input("breachFlag", sql.Bit, record.breachFlag)
      .input("summary", sql.NVarChar(1000), record.summary)
      .input("readingCount", sql.Int, record.readingCount)
      .input("minTemp", sql.Float, record.minTemp)
      .input("maxTemp", sql.Float, record.maxTemp)
      .input("content", sql.VarBinary(sql.MAX), buffer)
      .input("contentType", sql.NVarChar(80), contentType)
      .input("storageProvider", sql.NVarChar(40), record.storageProvider || "azure-sql")
      .input("blobName", sql.NVarChar(260), record.blobName || null)
      .input("blobUrl", sql.NVarChar(1000), record.blobUrl || null)
      .query(`
        INSERT INTO dbo.IotLogs (
          filename, batchId, scenario, source, logURI, logHash, breachFlag,
          summary, readingCount, minTemp, maxTemp, content, contentType,
          storageProvider, blobName, blobUrl
        )
        VALUES (
          @filename, @batchId, @scenario, @source, @logURI, @logHash, @breachFlag,
          @summary, @readingCount, @minTemp, @maxTemp, @content, @contentType,
          @storageProvider, @blobName, @blobUrl
        );
      `);
  });
}

async function getLogsForBatch(batchId) {
  await ensureSchema();

  return withAzureSqlRetry(async () => {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("batchId", sql.NVarChar(100), batchId)
      .query(`
        SELECT filename, batchId, scenario, source, logURI, logHash, breachFlag,
               summary, readingCount, minTemp, maxTemp, storageProvider, blobName, blobUrl, savedAt
        FROM dbo.IotLogs
        WHERE batchId = @batchId
        ORDER BY savedAt DESC;
      `);

    return result.recordset.map(mapRecord);
  });
}

async function readLogFile(filename) {
  await ensureSchema();

  return withAzureSqlRetry(async () => {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("filename", sql.NVarChar(260), filename)
      .query(`
        SELECT TOP 1 filename, content, contentType, storageProvider
        FROM dbo.IotLogs
        WHERE filename = @filename;
      `);

    if (!result.recordset.length) {
      const error = new Error("Log file not found");
      error.statusCode = 404;
      throw error;
    }

    const row = result.recordset[0];
    if (!row.content) {
      const error = new Error("Log file is stored in Azure Blob Storage");
      error.statusCode = 409;
      throw error;
    }

    return {
      filename: row.filename,
      buffer: Buffer.from(row.content),
      contentType: row.contentType || "application/octet-stream"
    };
  });
}

module.exports = {
  isEnabled,
  ensureSchema,
  saveLogRecord,
  getLogsForBatch,
  readLogFile,
  withAzureSqlRetry
};
