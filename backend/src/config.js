const path = require("path");

const defaultUploadDir = path.join(__dirname, "uploads");

function resolveUploadDir() {
  if (!process.env.UPLOAD_DIR) {
    return defaultUploadDir;
  }

  return path.isAbsolute(process.env.UPLOAD_DIR)
    ? process.env.UPLOAD_DIR
    : path.resolve(process.cwd(), process.env.UPLOAD_DIR);
}

function corsOrigins() {
  return (process.env.CORS_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

module.exports = {
  port: Number(process.env.PORT || 4000),
  uploadDir: resolveUploadDir(),
  corsOrigins,
  safeTempMinC: 2,
  safeTempMaxC: 8
};
