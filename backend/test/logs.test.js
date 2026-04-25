const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const request = require("supertest");

const tempUploadDir = fs.mkdtempSync(path.join(os.tmpdir(), "cold-chain-logs-"));
process.env.UPLOAD_DIR = tempUploadDir;
process.env.CORS_ORIGIN = "http://localhost:5173";

const app = require("../src/app");

test("health route reports service status", async () => {
  const response = await request(app).get("/api/health").expect(200);

  assert.equal(response.body.status, "ok");
  assert.equal(response.body.service, "cold-chain-iot-log-api");
});

test("simulate normal log returns compliant summary and digest", async () => {
  const response = await request(app)
    .post("/api/logs/simulate")
    .send({ batchId: "BATCH001", scenario: "normal" })
    .expect(201);

  assert.equal(response.body.breachFlag, false);
  assert.match(response.body.logHash, /^0x[a-fA-F0-9]{64}$/);
  assert.equal(response.body.readingCount, 12);
  assert.ok(response.body.summary.includes("compliant"));
  assert.equal(fs.existsSync(path.join(tempUploadDir, response.body.filename)), true);
});

test("simulate severe breach returns breach flag", async () => {
  const response = await request(app)
    .post("/api/logs/simulate")
    .send({ batchId: "BATCH002", scenario: "severe_breach" })
    .expect(201);

  assert.equal(response.body.breachFlag, true);
  assert.ok(response.body.maxTemp > 8);
  assert.ok(response.body.summary.includes("breach detected"));
});

test("verify detects original match and tampered mismatch", async () => {
  const simulated = await request(app)
    .post("/api/logs/simulate")
    .send({ batchId: "BATCH003", scenario: "normal" })
    .expect(201);

  const matching = await request(app)
    .post("/api/logs/verify")
    .send({
      filename: simulated.body.filename,
      expectedHash: simulated.body.logHash
    })
    .expect(200);

  assert.equal(matching.body.isMatch, true);

  const tampered = await request(app)
    .post("/api/logs/verify")
    .field("expectedHash", simulated.body.logHash)
    .attach("file", Buffer.from(JSON.stringify({ tampered: true })), "tampered.json")
    .expect(200);

  assert.equal(tampered.body.isMatch, false);
  assert.match(tampered.body.recomputedHash, /^0x[a-fA-F0-9]{64}$/);
});
