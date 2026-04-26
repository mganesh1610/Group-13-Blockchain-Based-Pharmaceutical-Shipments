const path = require("path");

const defaultUploadDir = process.env.VERCEL ? path.join("/tmp", "cold-chain-uploads") : path.join(__dirname, "uploads");

function resolveUploadDir() {
  if (!process.env.UPLOAD_DIR) {
    return defaultUploadDir;
  }

  return path.isAbsolute(process.env.UPLOAD_DIR)
    ? process.env.UPLOAD_DIR
    : path.resolve(process.cwd(), process.env.UPLOAD_DIR);
}

function corsOrigins() {
  const defaults = ["http://localhost:5173"];

  if (process.env.VERCEL_URL) {
    defaults.push(`https://${process.env.VERCEL_URL}`);
  }

  return (process.env.CORS_ORIGIN || defaults.join(","))
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function azureSqlConfig() {
  const server = process.env.AZURE_SQL_SERVER;
  const database = process.env.AZURE_SQL_DATABASE;
  const user = process.env.AZURE_SQL_USER;
  const password = process.env.AZURE_SQL_PASSWORD;

  return {
    enabled: Boolean(server && database && user && password),
    server,
    database,
    user,
    password,
    port: Number(process.env.AZURE_SQL_PORT || 1433),
    retryAttempts: Number(process.env.AZURE_SQL_RETRY_ATTEMPTS || 5),
    retryBaseDelayMs: Number(process.env.AZURE_SQL_RETRY_BASE_DELAY_MS || 5000),
    options: {
      encrypt: process.env.AZURE_SQL_ENCRYPT !== "false",
      trustServerCertificate: process.env.AZURE_SQL_TRUST_SERVER_CERTIFICATE === "true"
    }
  };
}

function azureBlobConfig() {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const containerName = process.env.AZURE_STORAGE_CONTAINER || "iot-logs";

  return {
    enabled: Boolean(connectionString),
    connectionString,
    containerName
  };
}

module.exports = {
  port: Number(process.env.PORT || 4000),
  uploadDir: resolveUploadDir(),
  corsOrigins,
  azureSql: azureSqlConfig(),
  azureBlob: azureBlobConfig(),
  safeTempMinC: 2,
  safeTempMaxC: 8
};
