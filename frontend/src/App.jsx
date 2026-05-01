import React, { useEffect, useMemo, useState, startTransition } from "react";
import {
  BrowserRouter,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams
} from "react-router-dom";
import { ethers } from "ethers";
import { QRCodeSVG } from "qrcode.react";
import { statusLabels, supplyChainAbi } from "./contractAbi";
import "./styles.css";

const DEFAULT_RPC_URL = import.meta.env.VITE_RPC_URL || "http://127.0.0.1:8545";
const DEFAULT_BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? "http://localhost:4000" : "");
const DEFAULT_CONTRACT_ADDRESS =
  import.meta.env.VITE_CONTRACT_ADDRESS || (import.meta.env.DEV ? "0x5FbDB2315678afecb367f032d93F642f64180aa3" : "");
const LOCAL_SANDBOX_RPC_URL = "http://127.0.0.1:8545";
const LOCAL_SANDBOX_CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const LOCAL_SANDBOX_CHAIN_ID = 31337n;
const LOCAL_SANDBOX_MNEMONIC = "test test test test test test test test test test test junk";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const POLYGON_AMOY_CHAIN_ID = 80002n;
const POLYGON_AMOY_CHAIN_HEX = "0x13882";
const POLYGON_AMOY_NETWORK_PARAMS = {
  chainId: POLYGON_AMOY_CHAIN_HEX,
  chainName: "Polygon Amoy Testnet",
  nativeCurrency: {
    name: "POL",
    symbol: "POL",
    decimals: 18
  },
  rpcUrls: ["https://rpc-amoy.polygon.technology/"],
  blockExplorerUrls: ["https://amoy.polygonscan.com/"]
};
const POLYGON_AMOY_EXPLORER_URL = "https://amoy.polygonscan.com";
const LOCAL_CONDITION_LOG_CACHE_KEY = "coldchain.localConditionLogs.v1";
const STATUS_OPTIONS = statusLabels
  .map((label, value) => ({ label, value }))
  .filter((status) => status.value > 0 && status.value < 6);
const STATUS_OPTIONS_BY_ROLE = {
  Distributor: [1, 2, 3, 5],
  Retailer: [2, 3, 4, 5]
};
const VALID_STATUS_TRANSITIONS = {
  0: [1, 3, 5],
  1: [2, 5],
  2: [3, 4, 5],
  3: [1, 4, 5],
  4: [5],
  5: [3, 4],
  6: []
};

const stakeholderRoleOptions = [
  { key: "admin", label: "Admin", roleHash: ethers.ZeroHash },
  { key: "manufacturer", label: "Manufacturer", roleName: "MANUFACTURER_ROLE" },
  { key: "distributor", label: "Distributor", roleName: "DISTRIBUTOR_ROLE" },
  { key: "retailer", label: "Retailer", roleName: "RETAILER_ROLE" },
  { key: "regulator", label: "Regulator", roleName: "REGULATOR_ROLE" }
];

const navItems = [
  { label: "Dashboard", to: "/" },
  { label: "Admin Access", to: "/admin/access", roles: ["Admin"], sidebarLabel: "Admin Access Control" },
  { label: "Register Batch", to: "/register", roles: ["Manufacturer"], sidebarLabel: "Manufacturer Portal" },
  {
    label: "Transfer Custody",
    to: "/transfer",
    roles: ["Manufacturer", "Distributor", "Admin"],
    sidebarLabel: "Custody Transfer"
  },
  {
    label: "Status Update",
    to: "/status",
    roles: ["Distributor", "Retailer"],
    sidebarLabel: "Status Update"
  },
  {
    label: "Condition Logs",
    to: "/conditions",
    roles: ["Distributor", "Retailer"],
    sidebarLabel: "Condition Logs"
  },
  { label: "Regulator Review", to: "/regulator", roles: ["Regulator"], sidebarLabel: "Regulator Review" },
  { label: "Batch Trace", to: "/trace", sidebarLabel: "Batch Trace" },
  { label: "Consumer Verify", to: "/verify", sidebarLabel: "Consumer Verification" },
  { label: "Tamper Check", to: "/tamper", sidebarLabel: "Tamper Evidence" }
];

const navByPath = Object.fromEntries(navItems.map((item) => [item.to, item]));
const stakeholderRoleOrder = ["Manufacturer", "Distributor", "Retailer", "Regulator", "Admin"];

function hasAnyRole(walletRoles, requiredRoles = []) {
  return requiredRoles.some((role) => walletRoles.includes(role));
}

function canAccessNavItem(item, walletRoles) {
  return !item.roles?.length || hasAnyRole(walletRoles, item.roles);
}

function roleAccessLabel(walletRoles, walletAddress) {
  if (walletRoles.length) return walletRoles.join(", ");
  return walletAddress ? "Unassigned wallet" : "Public read-only";
}

function stakeholderSessionText(walletRoles, walletAddress) {
  if (walletRoles.length) {
    return `Authorized as ${walletRoles.join(", ")}.`;
  }

  return walletAddress
    ? "This wallet is read-only until an admin assigns a stakeholder role."
    : "Consumer/read-only until a stakeholder wallet is connected.";
}

function requiredRoleText(roles = []) {
  if (!roles.length) return "Public read-only";
  return roles.join(" or ");
}

function primaryStakeholderRole(roles = [], fallback = "Stakeholder") {
  return stakeholderRoleOrder.find((role) => roles.includes(role)) || fallback;
}

function roleForAddress(roleMap, address, fallback = "Stakeholder") {
  if (!address || !roleMap) return fallback;
  return roleMap[ethers.getAddress(address).toLowerCase()] || fallback;
}

function statusOptionsForRoles(roles = [], currentStatus = null) {
  const allowedValues = new Set();

  roles.forEach((role) => {
    STATUS_OPTIONS_BY_ROLE[role]?.forEach((value) => allowedValues.add(value));
  });

  const roleFilteredOptions = allowedValues.size
    ? STATUS_OPTIONS.filter((status) => allowedValues.has(status.value))
    : STATUS_OPTIONS;

  if (currentStatus === null || currentStatus === undefined) {
    return roleFilteredOptions;
  }

  const validNextStatuses = new Set(VALID_STATUS_TRANSITIONS[Number(currentStatus)] || []);
  return roleFilteredOptions.filter((status) => validNextStatuses.has(status.value));
}

function shortAddress(address) {
  if (!address) return "Not set";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatDate(value) {
  const timestamp = Number(value || 0);
  if (!timestamp) return "Not recorded";
  return new Date(timestamp * 1000).toLocaleString();
}

function formatInputDate(value) {
  if (!value) return new Date().toISOString().slice(0, 10);
  return new Date(Number(value) * 1000).toISOString().slice(0, 10);
}

function tupleValue(item, key, index, fallback = "") {
  return item?.[key] ?? item?.[index] ?? fallback;
}

function collectErrorMessages(error, seen = new Set()) {
  if (!error) return [];
  if (typeof error === "string") return [error];
  if (typeof error !== "object" || seen.has(error)) return [];

  seen.add(error);

  const messages = [];
  ["shortMessage", "reason", "message"].forEach((key) => {
    if (typeof error[key] === "string") {
      messages.push(error[key]);
    }
  });

  ["error", "info", "data", "payload", "cause"].forEach((key) => {
    messages.push(...collectErrorMessages(error[key], seen));
  });

  return messages;
}

function parseError(error) {
  const messages = collectErrorMessages(error);
  const joined = messages.join(" ");
  const message =
    messages.find((item) => /Batch already registered|AccessControl|Only |Invalid |required|reverted/i.test(item)) ||
    messages[0] ||
    "Unexpected error";

  if (/Batch already registered/i.test(joined)) {
    return "This Batch ID is already registered on-chain. Use a new Batch ID, then submit again.";
  }

  if (/Invalid status transition/i.test(joined)) {
    return "This status is not allowed from the batch's current lifecycle state. Reload the batch and choose one of the available next statuses.";
  }

  if (/Only logistics custodian, regulator, or admin can record condition/i.test(joined)) {
    return "Only the current distributor/retailer custodian, regulator, or admin can anchor this condition log. Transfer custody to the connected wallet first, then retry.";
  }

  if (/Recipient must be manufacturer, distributor, or retailer/i.test(joined)) {
    return "Custody can only be transferred to a Manufacturer, Distributor, or Retailer wallet. Regulators review and verify without receiving shipment custody.";
  }

  if (/unknown custom error/i.test(joined)) {
    return "Connected wallet does not have the required smart-contract role for this transaction.";
  }

  if (/gas tip cap|priority fee|below minimum|maxPriorityFeePerGas/i.test(joined)) {
    return "Polygon Amoy rejected the transaction fee. The app now applies Amoy-safe gas settings; retry the transaction.";
  }

  if (/could not coalesce error/i.test(joined)) {
    return "The wallet could not submit this transaction. Check the MetaMask network and retry; on Polygon Amoy the app uses higher gas settings automatically.";
  }

  if (/could not decode result data|BAD_DATA/i.test(joined)) {
    return "No contract was found at the configured address on the selected network. For local sandbox testing, click Connect Sandbox Network, make sure MetaMask is on Local Hardhat, and retry.";
  }

  if (/insufficient funds|insufficient balance|missing revert data/i.test(joined)) {
    return "The connected wallet could not pay for this on-chain transaction. Add Polygon Amoy test POL to this stakeholder wallet, then retry.";
  }

  return message.replace(/^execution reverted: /i, "");
}

function appUrl(path) {
  const base = import.meta.env.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  return `${window.location.origin}${normalizedBase}${normalizedPath}`;
}

function filenameFromLogUri(logURI = "") {
  const [path] = String(logURI).split("?");
  return path.split("/").filter(Boolean).pop() || "";
}

function serializeConditionPayload(payload) {
  return JSON.stringify(payload, null, 2);
}

function readLocalConditionLogCache() {
  if (typeof window === "undefined" || !window.localStorage) {
    return {};
  }

  try {
    return JSON.parse(window.localStorage.getItem(LOCAL_CONDITION_LOG_CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeLocalConditionLogCache(cache) {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  try {
    const entries = Object.entries(cache)
      .sort(([, left], [, right]) => String(right.savedAt || "").localeCompare(String(left.savedAt || "")))
      .slice(0, 40);
    window.localStorage.setItem(LOCAL_CONDITION_LOG_CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // The cache only supports the browser demo path; blockchain anchoring can still proceed without it.
  }
}

function cacheLocalConditionLog(logResult) {
  if (!logResult?.filename || !logResult?.rawContent) {
    return;
  }

  const cache = readLocalConditionLogCache();
  cache[logResult.filename] = {
    filename: logResult.filename,
    rawContent: logResult.rawContent,
    logHash: logResult.logHash,
    summary: logResult.summary,
    savedAt: new Date().toISOString()
  };
  writeLocalConditionLogCache(cache);
}

function getCachedLocalConditionLog(filename) {
  const safeFilename = filenameFromLogUri(filename);
  if (!safeFilename) {
    return null;
  }

  return readLocalConditionLogCache()[safeFilename] || null;
}

function buildHashVerificationResult({ expectedHash, recomputedHash, sourceLabel }) {
  const isMatch = recomputedHash.toLowerCase() === expectedHash.toLowerCase();
  return {
    recomputedHash,
    expectedHash,
    isMatch,
    message: isMatch
      ? `MATCH: ${sourceLabel} matches the anchored digest`
      : `MISMATCH: ${sourceLabel} has changed or is not the anchored log`
  };
}

async function verifyBrowserFileHash(file, expectedHash) {
  const buffer = new Uint8Array(await file.arrayBuffer());
  return buildHashVerificationResult({
    expectedHash,
    recomputedHash: ethers.keccak256(buffer),
    sourceLabel: "selected file"
  });
}

function verifyCachedConditionLogHash(cachedLog, expectedHash) {
  return buildHashVerificationResult({
    expectedHash,
    recomputedHash: ethers.keccak256(ethers.toUtf8Bytes(cachedLog.rawContent)),
    sourceLabel: "browser-cached simulated log"
  });
}

function validateWalletAddress(address) {
  if (!ethers.isAddress(address)) {
    throw new Error("Enter a valid MetaMask wallet address.");
  }

  return ethers.getAddress(address);
}

function isLocalSandboxConnection({ chainId, rpcUrl, contractAddress, networkStatus }) {
  return (
    chainId === LOCAL_SANDBOX_CHAIN_ID ||
    networkStatus === "Local Hardhat" ||
    rpcUrl.replace(/\/$/, "") === LOCAL_SANDBOX_RPC_URL ||
    contractAddress.toLowerCase() === LOCAL_SANDBOX_CONTRACT_ADDRESS.toLowerCase()
  );
}

function isPolygonAmoyConnection({ rpcUrl, contractAddress }) {
  const normalizedRpc = String(rpcUrl || "").toLowerCase();
  const normalizedContract = String(contractAddress || "").toLowerCase();
  const configuredContract = String(DEFAULT_CONTRACT_ADDRESS || "").toLowerCase();

  return (
    normalizedRpc.includes("amoy") ||
    normalizedRpc.includes("80002") ||
    (configuredContract && normalizedContract === configuredContract)
  );
}

function contractExplorerUrl({ contractAddress, rpcUrl, networkStatus }) {
  if (!ethers.isAddress(contractAddress)) {
    return "";
  }

  if (isLocalSandboxConnection({ rpcUrl, contractAddress, networkStatus })) {
    return "";
  }

  if (!isPolygonAmoyConnection({ rpcUrl, contractAddress })) {
    return "";
  }

  return `${POLYGON_AMOY_EXPLORER_URL}/address/${contractAddress}`;
}

async function switchToPolygonAmoy(browserProvider) {
  try {
    await browserProvider.send("wallet_switchEthereumChain", [{ chainId: POLYGON_AMOY_CHAIN_HEX }]);
  } catch (error) {
    if (error?.code !== 4902) {
      throw error;
    }

    await browserProvider.send("wallet_addEthereumChain", [POLYGON_AMOY_NETWORK_PARAMS]);
  }
}

function localSandboxTestKey(index) {
  return ethers.HDNodeWallet.fromPhrase(LOCAL_SANDBOX_MNEMONIC, undefined, `m/44'/60'/0'/0/${index}`).privateKey;
}

const conditionScenarioProfiles = {
  normal: [3.4, 3.9, 4.2, 4.8, 5.1, 5.5, 5.9, 6.2, 6.5, 6.9, 7.2, 7.6],
  mild_breach: [3.6, 4.1, 4.7, 5.3, 6.4, 7.1, 8.4, 8.9, 7.6, 6.2, 5.4, 4.8],
  severe_breach: [3.5, 4.0, 4.8, 6.2, 8.6, 10.1, 11.7, 12.3, 9.4, 7.1, 5.8, 4.6]
};

function sanitizeLogSegment(value, fallback = "log") {
  const safe = String(value || fallback)
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return safe || fallback;
}

function buildSimulatedReadings(batchId, scenario, count = 12) {
  const temps = conditionScenarioProfiles[scenario] || conditionScenarioProfiles.normal;
  const start = Date.now() - count * 15 * 60 * 1000;

  return Array.from({ length: count }, (_, index) => ({
    time: new Date(start + index * 15 * 60 * 1000).toISOString(),
    tempC: temps[index % temps.length],
    humidity: 58 + (index % 6),
    gps: index < count / 2 ? "Phoenix, AZ" : "Tempe, AZ",
    batchId
  }));
}

function buildLocalSimulationResult(batchId, scenario, readingCount = 12) {
  const normalizedScenario = conditionScenarioProfiles[scenario] ? scenario : "normal";
  const normalizedCount = Math.max(1, Math.min(Number(readingCount) || 12, 96));
  const generatedAt = new Date().toISOString();
  const readings = buildSimulatedReadings(batchId, normalizedScenario, normalizedCount);
  const temperatures = readings.map((reading) => Number(reading.tempC)).filter(Number.isFinite);
  const minTemp = Math.min(...temperatures);
  const maxTemp = Math.max(...temperatures);
  const breachFlag = temperatures.some((tempC) => tempC < 2 || tempC > 8);
  const summary = `${readings.length} readings, min ${minTemp.toFixed(1)}C, max ${maxTemp.toFixed(1)}C, ${
    breachFlag ? "breach detected" : "compliant"
  }`;
  const payload = {
    batchId,
    sensorId: `TEMP-${normalizedScenario.toUpperCase().replace(/[^A-Z0-9]/g, "-")}`,
    scenario: normalizedScenario,
    generatedAt,
    safeRangeC: { min: 2, max: 8 },
    readings
  };
  const serializedPayload = serializeConditionPayload(payload);
  const uniqueSuffix = globalThis.crypto?.randomUUID?.().slice(0, 8) || String(Date.now()).slice(-8);
  const filename = `${sanitizeLogSegment(batchId, "batch")}-${sanitizeLogSegment(
    normalizedScenario,
    "simulation"
  )}-${Date.now()}-${uniqueSuffix}.json`;

  return {
    filename,
    logURI: `/simulated-logs/${filename}`,
    logHash: ethers.keccak256(ethers.toUtf8Bytes(serializedPayload)),
    breachFlag,
    summary,
    readingCount: readings.length,
    minTemp,
    maxTemp,
    rawContent: serializedPayload,
    payload
  };
}

async function getStakeholderRoleHash(contract, roleKey) {
  const role = stakeholderRoleOptions.find((option) => option.key === roleKey);
  if (!role) {
    throw new Error("Select a valid stakeholder role.");
  }

  if (role.roleHash) {
    return role.roleHash;
  }

  return contract[role.roleName]();
}

function normalizeBatch(batch) {
  return {
    batchId: tupleValue(batch, "batchId", 0),
    productName: tupleValue(batch, "productName", 1),
    origin: tupleValue(batch, "origin", 2),
    manufactureDate: Number(tupleValue(batch, "manufactureDate", 3, 0)),
    manufacturer: tupleValue(batch, "manufacturer", 4),
    currentCustodian: tupleValue(batch, "currentCustodian", 5),
    status: Number(tupleValue(batch, "status", 6, 0)),
    exists: Boolean(tupleValue(batch, "exists", 7, false)),
    recalled: Boolean(tupleValue(batch, "recalled", 8, false)),
    lastStatusNote: tupleValue(batch, "lastStatusNote", 9)
  };
}

function normalizeCustodyRecord(item) {
  return {
    from: tupleValue(item, "from", 0),
    to: tupleValue(item, "to", 1),
    timestamp: Number(tupleValue(item, "timestamp", 2, 0)),
    location: tupleValue(item, "location", 3),
    notes: tupleValue(item, "notes", 4)
  };
}

function normalizeConditionRecord(item) {
  return {
    logHash: tupleValue(item, "logHash", 0),
    logURI: tupleValue(item, "logURI", 1),
    breachFlag: Boolean(tupleValue(item, "breachFlag", 2, false)),
    summary: tupleValue(item, "summary", 3),
    timestamp: Number(tupleValue(item, "timestamp", 4, 0)),
    submittedBy: tupleValue(item, "submittedBy", 5)
  };
}

function normalizeVerificationRecord(item) {
  return {
    verificationType: tupleValue(item, "verificationType", 0),
    result: Boolean(tupleValue(item, "result", 1, false)),
    remarks: tupleValue(item, "remarks", 2),
    timestamp: Number(tupleValue(item, "timestamp", 3, 0)),
    verifiedBy: tupleValue(item, "verifiedBy", 4)
  };
}

function normalizeRecall(recall) {
  return {
    isRecalled: Boolean(tupleValue(recall, "isRecalled", 0, false)),
    reason: tupleValue(recall, "reason", 1),
    timestamp: Number(tupleValue(recall, "timestamp", 2, 0)),
    actionBy: tupleValue(recall, "actionBy", 3)
  };
}

async function loadBatchTrace(contract, batchId) {
  if (!contract || !batchId) return null;

  const exists = await contract.batchExists(batchId);
  if (!exists) {
    return { notFound: true, batchId };
  }

  const [batch, custody, conditions, verifications, recall] = await Promise.all([
    contract.getBatch(batchId),
    contract.getCustodyHistory(batchId),
    contract.getConditionHistory(batchId),
    contract.getVerificationHistory(batchId),
    contract.getRecallInfo(batchId)
  ]);
  const normalizedBatch = normalizeBatch(batch);
  const normalizedCustody = custody.map(normalizeCustodyRecord);
  const normalizedConditions = conditions.map(normalizeConditionRecord);
  const normalizedVerifications = verifications.map(normalizeVerificationRecord);
  const normalizedRecall = normalizeRecall(recall);
  const knownAddresses = [
    normalizedBatch.manufacturer,
    normalizedBatch.currentCustodian,
    ...normalizedCustody.flatMap((record) => [record.from, record.to]),
    ...normalizedConditions.map((record) => record.submittedBy),
    ...normalizedVerifications.map((record) => record.verifiedBy),
    normalizedRecall.actionBy
  ].filter((address) => ethers.isAddress(address) && address !== ZERO_ADDRESS);
  const uniqueAddresses = Array.from(new Set(knownAddresses.map((address) => ethers.getAddress(address).toLowerCase())));
  const roleEntries = await Promise.all(
    uniqueAddresses.map(async (address) => {
      const roles = await detectWalletRoles(contract, address).catch(() => []);
      return [address, primaryStakeholderRole(roles)];
    })
  );
  const roleMap = Object.fromEntries(roleEntries);

  return {
    batch: {
      ...normalizedBatch,
      manufacturerRole: roleForAddress(roleMap, normalizedBatch.manufacturer, "Manufacturer"),
      currentCustodianRole: roleForAddress(roleMap, normalizedBatch.currentCustodian)
    },
    custody: normalizedCustody.map((record) => ({
      ...record,
      fromRole: roleForAddress(roleMap, record.from),
      toRole: roleForAddress(roleMap, record.to)
    })),
    conditions: normalizedConditions.map((record) => ({
      ...record,
      submittedByRole: roleForAddress(roleMap, record.submittedBy)
    })),
    verifications: normalizedVerifications.map((record) => ({
      ...record,
      verifiedByRole: roleForAddress(roleMap, record.verifiedBy)
    })),
    recall: {
      ...normalizedRecall,
      actionByRole: roleForAddress(roleMap, normalizedRecall.actionBy, "Regulator")
    }
  };
}

async function detectWalletRoles(contract, address) {
  if (!contract || !address) return [];

  const [manufacturerRole, distributorRole, retailerRole, regulatorRole] = await Promise.all([
    contract.MANUFACTURER_ROLE(),
    contract.DISTRIBUTOR_ROLE(),
    contract.RETAILER_ROLE(),
    contract.REGULATOR_ROLE()
  ]);

  const roleChecks = [
    ["Manufacturer", manufacturerRole],
    ["Distributor", distributorRole],
    ["Retailer", retailerRole],
    ["Regulator", regulatorRole],
    ["Admin", ethers.ZeroHash]
  ];

  const checks = await Promise.all(roleChecks.map(([, role]) => contract.hasRole(role, address)));
  return roleChecks.filter((_, index) => checks[index]).map(([label]) => label);
}

function StatusBadge({ status, recalled }) {
  const label = statusLabels[Number(status)] || "Unknown";
  const kind = recalled || label === "Recalled" ? "recalled" : label === "Flagged" ? "flagged" : "normal";
  return <span className={`status-badge ${kind}`}>{label}</span>;
}

function Notice({ notice, onDismiss }) {
  if (!notice) return null;

  return (
    <div className={`notice ${notice.type || "info"}`} role="status">
      <span>{notice.message}</span>
      <button type="button" onClick={onDismiss} aria-label="Dismiss message">
        Close
      </button>
    </div>
  );
}

function AccessGate({ app, item, children }) {
  if (!item?.roles?.length || canAccessNavItem(item, app.walletRoles)) {
    return children;
  }

  const currentAccess = roleAccessLabel(app.walletRoles, app.walletAddress);
  const message = app.walletAddress
    ? `Connected wallet access: ${currentAccess}. Required role: ${requiredRoleText(item.roles)}.`
    : `Required role: ${requiredRoleText(item.roles)}. Connect a stakeholder wallet assigned to this role.`;

  return (
    <section className="page-card access-denied">
      <p className="eyebrow">Restricted Workspace</p>
      <h2>{item.label}</h2>
      <p>{message}</p>
      <p className="muted">
        Public batch trace, consumer verification, and tamper-evidence checks remain available without a role.
      </p>
      <div className="button-row">
        <button type="button" onClick={app.connectWallet}>
          {app.walletAddress ? "Reconnect Selected Wallet" : "Connect Stakeholder Wallet"}
        </button>
        {app.walletAddress ? (
          <button type="button" className="ghost" onClick={app.disconnectWallet}>
            Logout
          </button>
        ) : null}
      </div>
    </section>
  );
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function AddressLine({ label, address, onCopy, roleLabel }) {
  return (
    <div className="address-line">
      <span>{label}</span>
      <div className="address-value">
        {roleLabel ? <strong>{roleLabel}</strong> : null}
        <code title={address}>{address || "Not set"}</code>
      </div>
      {address ? (
        <button type="button" className="ghost small" onClick={() => onCopy(address, label)}>
          Copy
        </button>
      ) : null}
    </div>
  );
}

function TimelineList({ empty, items, render }) {
  if (!items?.length) {
    return <p className="muted">{empty}</p>;
  }

  return <div className="timeline-list">{items.map(render)}</div>;
}

function TraceView({ trace, onCopy, contractAddress, contractExplorerUrl }) {
  if (!trace) {
    return <p className="muted">Load a batch to view blockchain provenance records.</p>;
  }

  if (trace.notFound) {
    return (
      <div className="warning-panel">
        <strong>Batch not found.</strong>
        <p>{trace.batchId} is not registered on this contract.</p>
      </div>
    );
  }

  const { batch, custody, conditions, verifications, recall } = trace;
  const verifyUrl = appUrl(`/verify/${batch.batchId}`);

  return (
    <div className="trace-stack">
      {(batch.recalled || Number(batch.status) === 6) && (
        <div className="danger-panel">
          <strong>Recall warning</strong>
          <p>{recall.reason || batch.lastStatusNote || "This batch has been recalled."}</p>
        </div>
      )}

      {Number(batch.status) === 5 && !batch.recalled && (
        <div className="warning-panel">
          <strong>Condition breach flagged</strong>
          <p>{batch.lastStatusNote || "A temperature or condition breach was anchored on-chain."}</p>
        </div>
      )}

      <section className="evidence-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Registered Batch</p>
            <h2>{batch.batchId}</h2>
          </div>
          <StatusBadge status={batch.status} recalled={batch.recalled} />
        </div>

        <div className="metadata-grid">
          <div>
            <span>Product</span>
            <strong>{batch.productName}</strong>
          </div>
          <div>
            <span>Origin</span>
            <strong>{batch.origin}</strong>
          </div>
          <div>
            <span>Manufactured</span>
            <strong>{formatDate(batch.manufactureDate)}</strong>
          </div>
          <div>
            <span>Last note</span>
            <strong>{batch.lastStatusNote || "No status note"}</strong>
          </div>
        </div>

        {contractExplorerUrl ? (
          <div className="contract-proof-card">
            <div>
              <span>Smart contract proof</span>
              <strong>{shortAddress(contractAddress)}</strong>
              <p>Open the deployed contract on PolygonScan to inspect transactions, events, and verified activity.</p>
            </div>
            <a href={contractExplorerUrl} target="_blank" rel="noreferrer">
              View Contract
            </a>
          </div>
        ) : null}

        <div className="address-grid">
          <AddressLine
            label="Manufacturer"
            address={batch.manufacturer}
            roleLabel={batch.manufacturerRole}
            onCopy={onCopy}
          />
          <AddressLine
            label="Current custodian"
            address={batch.currentCustodian}
            roleLabel={batch.currentCustodianRole}
            onCopy={onCopy}
          />
        </div>
      </section>

      <section className="evidence-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Consumer QR</p>
            <h2>Public Verification Route</h2>
          </div>
          <div className="qr-box">
            <QRCodeSVG value={verifyUrl} size={92} />
          </div>
        </div>
        <p className="muted breakable">{verifyUrl}</p>
      </section>

      <section className="timeline-grid">
        <div className="timeline-column">
          <h3>Custody Chain</h3>
          <TimelineList
            empty="No custody transfers yet."
            items={custody}
            render={(record, index) => (
              <article className="timeline-card" key={`${record.timestamp}-${index}`}>
                <strong>
                  {shortAddress(record.from)} to {shortAddress(record.to)}
                </strong>
                <p>{record.location || "No location recorded"}</p>
                <p>{record.notes || "No transfer notes"}</p>
                <AddressLine label="From" address={record.from} onCopy={onCopy} />
                <AddressLine label="To" address={record.to} onCopy={onCopy} />
                <time>{formatDate(record.timestamp)}</time>
              </article>
            )}
          />
        </div>

        <div className="timeline-column">
          <h3>Condition Proofs</h3>
          <TimelineList
            empty="No condition records yet."
            items={conditions}
            render={(record, index) => (
              <article className={`timeline-card ${record.breachFlag ? "breach" : ""}`} key={`${record.timestamp}-${index}`}>
                <strong>{record.breachFlag ? "Breach Log" : "Compliant Log"}</strong>
                <p>{record.summary}</p>
                <p className="breakable">{record.logURI}</p>
                <code className="breakable">{record.logHash}</code>
                <AddressLine label="Submitted by" address={record.submittedBy} onCopy={onCopy} />
                <time>{formatDate(record.timestamp)}</time>
              </article>
            )}
          />
        </div>

        <div className="timeline-column">
          <h3>Verification</h3>
          <TimelineList
            empty="No regulator verification yet."
            items={verifications}
            render={(record, index) => (
              <article className="timeline-card" key={`${record.timestamp}-${index}`}>
                <strong>{record.verificationType}</strong>
                <p>{record.result ? "Approved / valid" : "Rejected / issue found"}</p>
                <p>{record.remarks || "No remarks"}</p>
                <AddressLine label="Verified by" address={record.verifiedBy} onCopy={onCopy} />
                <time>{formatDate(record.timestamp)}</time>
              </article>
            )}
          />
          {recall?.isRecalled ? (
            <article className="timeline-card breach">
              <strong>Recall Action</strong>
              <p>{recall.reason}</p>
              <AddressLine label="Action by" address={recall.actionBy} onCopy={onCopy} />
              <time>{formatDate(recall.timestamp)}</time>
            </article>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function ConsumerSummary({ trace }) {
  if (!trace) {
    return <p className="muted">Enter a batch ID or scan a QR code from the batch trace page.</p>;
  }

  if (trace.notFound) {
    return (
      <div className="warning-panel">
        <strong>Unregistered batch</strong>
        <p>This batch ID was not found on the deployed contract. Do not treat it as an authenticated shipment.</p>
      </div>
    );
  }

  const { batch, custody, conditions, verifications, recall } = trace;
  const hasBreach = Number(batch.status) === 5 || conditions.some((record) => record.breachFlag);
  const isRecalled = batch.recalled || Number(batch.status) === 6 || recall?.isRecalled;
  const latestCondition = conditions[conditions.length - 1];
  const latestVerification = verifications[verifications.length - 1];
  const custodyRoles = [
    batch.manufacturerRole,
    ...custody.map((record) => record.toRole),
    custody.length ? null : batch.currentCustodianRole
  ].filter(Boolean);
  const uniqueCustodyRoles = [...new Set(custodyRoles)];
  const resultClass = isRecalled ? "danger" : hasBreach ? "warning" : "success";
  const resultTitle = isRecalled
    ? "Do not use: regulator recall recorded"
    : hasBreach
      ? "Use caution: cold-chain exception found"
      : "Authentic batch record found";
  const resultText = isRecalled
    ? recall.reason || batch.lastStatusNote || "This batch has a recall record on-chain."
    : hasBreach
      ? latestCondition?.summary || batch.lastStatusNote || "A condition breach was recorded for this batch."
      : "This batch is registered on-chain and no recall is recorded.";

  return (
    <div className="consumer-summary">
      <section className={`consumer-verdict ${resultClass}`}>
        <div>
          <p className="eyebrow">Verification Result</p>
          <h3>{resultTitle}</h3>
          <p>{resultText}</p>
        </div>
        <StatusBadge status={batch.status} recalled={batch.recalled} />
      </section>

      <div className="consumer-card-grid">
        <article>
          <span>Product</span>
          <strong>{batch.productName}</strong>
          <p>Batch ID: {batch.batchId}</p>
        </article>
        <article>
          <span>Current holder</span>
          <strong>{batch.currentCustodianRole}</strong>
          <p>{statusLabels[batch.status]} at this point in the lifecycle.</p>
        </article>
        <article>
          <span>Cold-chain evidence</span>
          <strong>{conditions.length} log proof(s)</strong>
          <p>{latestCondition?.summary || "No condition log has been anchored yet."}</p>
        </article>
        <article>
          <span>Regulator review</span>
          <strong>{latestVerification ? latestVerification.verificationType : "Pending"}</strong>
          <p>
            {latestVerification
              ? `${latestVerification.result ? "Approved" : "Issue found"} by ${latestVerification.verifiedByRole}.`
              : "No regulator verification has been added yet."}
          </p>
        </article>
      </div>

      <section className="consumer-chain">
        <p className="eyebrow">Supply Chain Path</p>
        <div className="consumer-chain-steps">
          {uniqueCustodyRoles.map((role, index) => (
            <React.Fragment key={`${role}-${index}`}>
              <span>{role}</span>
              {index < uniqueCustodyRoles.length - 1 ? <b aria-hidden="true">→</b> : null}
            </React.Fragment>
          ))}
        </div>
        <p className="muted">
          Public verification summarizes the provenance trail. Full wallet-level custody and condition records remain in
          Batch Trace for audit review.
        </p>
      </section>
    </div>
  );
}

function Layout({ app, children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isRailHidden, setIsRailHidden] = useState(false);
  const visibleNavItems = navItems.filter((item) => canAccessNavItem(item, app.walletRoles));
  const visibleWorkspaceItems = visibleNavItems.filter((item) => item.sidebarLabel && item.to !== "/");
  const showSandboxTools = !app.walletAddress || app.walletRoles.includes("Admin");

  useEffect(() => {
    app.setNotice(null);
  }, [location.pathname, location.search]);

  async function refreshActiveTrace() {
    const batchId = app.activeBatchId.trim();
    if (!batchId) {
      app.setNotice({ type: "warning", message: "Enter a Batch ID before refreshing the trace." });
      return;
    }

    const trace = await app.refreshBatch(batchId);
    navigate("/trace");
    window.setTimeout(() => {
      app.setNotice(
        trace?.notFound
          ? { type: "warning", message: `Batch ${batchId} is not registered on-chain yet.` }
          : { type: "success", message: `Loaded blockchain trace for ${batchId}.` }
      );
    }, 0);
  }

  return (
    <div className={`app-shell${isRailHidden ? " rail-hidden" : ""}`}>
      <button
        type="button"
        className="rail-toggle"
        aria-controls="control-sidebar"
        aria-expanded={!isRailHidden}
        aria-label={isRailHidden ? "Show sidebar menu" : "Hide sidebar menu"}
        title={isRailHidden ? "Show menu" : "Hide menu"}
        onClick={() => setIsRailHidden((current) => !current)}
      >
        <span className="rail-toggle__icon" aria-hidden="true">
          <span className="rail-toggle__bar" />
          <span className="rail-toggle__bar" />
          <span className="rail-toggle__bar" />
          <span className="rail-toggle__chevron" />
        </span>
        <span className="sr-only">{isRailHidden ? "Show sidebar menu" : "Hide sidebar menu"}</span>
      </button>

      <aside id="control-sidebar" className="side-rail" aria-label="Control sidebar" hidden={isRailHidden}>
        <NavLink className="brand-mark" to="/" aria-label="Open dashboard">
          <span>CC</span>
          <div>
            <strong>ColdChain</strong>
            <small>Provenance</small>
          </div>
        </NavLink>

        <div className="rail-section stakeholder-session">
          <p className="eyebrow">Stakeholder Access</p>
          <div className="session-card">
            <span>Connected organization</span>
            <strong>{app.walletAddress ? shortAddress(app.walletAddress) : "No wallet connected"}</strong>
            <p>{stakeholderSessionText(app.walletRoles, app.walletAddress)}</p>
            {app.walletAddress ? (
              <div className="session-actions">
                <button type="button" className="secondary" onClick={app.connectWallet}>
                  Reconnect Selected Wallet
                </button>
                <button type="button" className="ghost" onClick={app.disconnectWallet}>
                  Logout
                </button>
              </div>
            ) : (
              <button type="button" className="secondary" onClick={app.connectWallet}>
                Connect Organization Wallet
              </button>
            )}
          </div>
        </div>

        <div className="rail-section">
          <p className="eyebrow">Active Shipment</p>
          <Field label="Batch ID">
            <input value={app.activeBatchId} onChange={(event) => app.setActiveBatchId(event.target.value)} />
          </Field>
          <button type="button" onClick={refreshActiveTrace}>
            Refresh Trace
          </button>
        </div>

        <div className="rail-section workspace-links">
          <p className="eyebrow">Role Workspaces</p>
          {visibleWorkspaceItems.map((item) => (
            <NavLink key={item.to} to={item.to}>
              {item.sidebarLabel}
            </NavLink>
          ))}
        </div>

        {showSandboxTools ? (
          <details className="rail-section compact sandbox-tools">
            <summary>Developer sandbox</summary>
            <p className="rail-note">
              Local Hardhat shortcuts only. Production stakeholders use their own organization wallets.
            </p>
            <button type="button" className="secondary" onClick={app.connectLocalNetwork}>
              Connect Sandbox Network
            </button>
            <button type="button" className="secondary" onClick={app.grantDemoRoles}>
              Assign Sandbox Roles
            </button>
            <button type="button" onClick={app.demoRegisterBatch}>
              Run Manufacturer Step
            </button>
            <button type="button" onClick={app.demoSendToDistributor}>
              Run Distributor Step
            </button>
            <button type="button" onClick={app.demoDeliverAndVerify}>
              Run Retailer + Regulator Step
            </button>
            <button type="button" className="danger-soft" onClick={app.demoBreachAndRecall}>
              Run Breach + Recall Scenario
            </button>
            <button type="button" className="ghost" onClick={app.demoUnauthorizedAction}>
              Run Unauthorized Action Check
            </button>
          </details>
        ) : null}

        <details className="rail-section compact">
          <summary>Edit connection details</summary>
          <Field label="Local RPC">
            <input value={app.rpcUrl} onChange={(event) => app.setRpcUrl(event.target.value)} />
          </Field>
          <Field label="Contract">
            <input value={app.contractAddress} onChange={(event) => app.setContractAddress(event.target.value)} />
          </Field>
          <Field label="Backend API">
            <input value={app.backendUrl} onChange={(event) => app.setBackendUrl(event.target.value)} />
          </Field>
        </details>

        <details className="rail-section wallet-list compact">
          <summary>Sandbox stakeholder addresses</summary>
          {app.networkStatus === "Local Hardhat" ? (
            <p className="rail-note">
              MetaMask does not allow websites to import accounts automatically. Copy a local test key, then import it
              manually in MetaMask.
            </p>
          ) : null}
          <p className="eyebrow">Sandbox Accounts</p>
          {app.stakeholders.map((stakeholder) => (
            <div className="wallet-row" key={stakeholder.role}>
              <strong>{stakeholder.role}</strong>
              <code>{shortAddress(stakeholder.address)}</code>
              <div className="wallet-actions">
                <button
                  type="button"
                  className="ghost small"
                  onClick={() => app.copyText(stakeholder.address, `${stakeholder.role} address`)}
                >
                  Copy address
                </button>
                {app.networkStatus === "Local Hardhat" && stakeholder.privateKey ? (
                  <button
                    type="button"
                    className="ghost small"
                    onClick={() => app.copyText(stakeholder.privateKey, `${stakeholder.role} private key`)}
                  >
                    Copy test key
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </details>
      </aside>

      <main className="workspace" aria-label="App content">
        <header className="hero" role="banner">
          <div>
            <p className="eyebrow">Pharmaceutical Cold Chain</p>
            <h1>ColdChain Provenance</h1>
            <p>
              Track custody, temperature integrity, compliance review, and consumer verification for regulated
              pharmaceutical shipments.
            </p>
          </div>
          <div className="hero-actions">
            <div className="status-pill">
              <span>Network</span>
              <strong>{app.networkStatus}</strong>
            </div>
            <div className="status-pill">
              <span>Access Mode</span>
              <strong>{roleAccessLabel(app.walletRoles, app.walletAddress)}</strong>
            </div>
            {app.contractExplorerUrl ? (
              <a className="contract-scan-link" href={app.contractExplorerUrl} target="_blank" rel="noreferrer">
                <span>Contract</span>
                <strong>{shortAddress(app.contractAddress)}</strong>
                <small>Open PolygonScan</small>
              </a>
            ) : null}
            {app.walletAddress ? (
              <div className="hero-wallet-actions">
                <button type="button" onClick={app.connectWallet}>
                  Reconnect Selected Wallet
                </button>
                <button type="button" className="ghost logout-button" onClick={app.disconnectWallet}>
                  Logout
                </button>
              </div>
            ) : (
              <button type="button" onClick={app.connectWallet}>
                Connect Stakeholder Wallet
              </button>
            )}
          </div>
        </header>

        <nav className="top-nav" aria-label="Primary navigation">
          {visibleNavItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === "/"}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <Notice notice={app.notice} onDismiss={() => app.setNotice(null)} />
        {children}
      </main>
    </div>
  );
}

function DashboardPage({ app }) {
  const batches = app.batches;
  const totals = useMemo(() => {
    return batches.reduce(
      (acc, trace) => {
        acc.total += 1;
        const status = Number(trace.batch.status);
        if (status === 1 || status === 2 || status === 3) acc.inTransit += 1;
        if (status === 4) acc.delivered += 1;
        if (status === 5) acc.flagged += 1;
        if (status === 6 || trace.batch.recalled) acc.recalled += 1;
        return acc;
      },
      { total: 0, inTransit: 0, delivered: 0, flagged: 0, recalled: 0 }
    );
  }, [batches]);

  return (
    <section className="page-grid">
      <div className="page-card wide">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Operations Dashboard</p>
            <h2>Supply Chain Overview</h2>
          </div>
          <button type="button" onClick={app.refreshDashboard}>
            Refresh Dashboard
          </button>
        </div>

        <div className="metric-grid">
          <Metric label="Total batches" value={totals.total} />
          <Metric label="In transit / stored" value={totals.inTransit} />
          <Metric label="Delivered" value={totals.delivered} />
          <Metric label="Flagged" value={totals.flagged} tone="warning" />
          <Metric label="Recalled" value={totals.recalled} tone="danger" />
        </div>
      </div>

      <div className="page-card">
        <h2>Recent Activity</h2>
        {app.activity.length ? (
          <ul className="activity-list">
            {app.activity.map((item, index) => (
              <li key={`${item}-${index}`}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="muted">No browser actions yet.</p>
        )}
      </div>

      <div className="page-card">
        <h2>Alerts</h2>
        {batches.some((trace) => trace.batch.recalled || Number(trace.batch.status) === 5) ? (
          batches
            .filter((trace) => trace.batch.recalled || Number(trace.batch.status) === 5)
            .map((trace) => (
              <div className="alert-row" key={trace.batch.batchId}>
                <StatusBadge status={trace.batch.status} recalled={trace.batch.recalled} />
                <span>{trace.batch.batchId}</span>
                <strong>{trace.batch.lastStatusNote}</strong>
              </div>
            ))
        ) : (
          <p className="muted">No breach or recall warnings on loaded batches.</p>
        )}
      </div>
    </section>
  );
}

function Metric({ label, value, tone = "normal" }) {
  return (
    <div className={`metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function AdminAccessPage({ app }) {
  const [form, setForm] = useState({
    walletAddress: "",
    role: stakeholderRoleOptions[0].key
  });
  const [roleStatus, setRoleStatus] = useState(null);
  const selectedRole = stakeholderRoleOptions.find((role) => role.key === form.role) || stakeholderRoleOptions[0];

  async function checkRole(event) {
    event.preventDefault();

    try {
      const wallet = validateWalletAddress(form.walletAddress);
      if (!app.readContract) {
        throw new Error("Contract connection is not ready.");
      }

      const roleHash = await getStakeholderRoleHash(app.readContract, form.role);
      const hasAccess = await app.readContract.hasRole(roleHash, wallet);
      setRoleStatus({ wallet, role: selectedRole.label, hasAccess });
      app.setNotice({
        type: hasAccess ? "success" : "warning",
        message: `${shortAddress(wallet)} ${hasAccess ? "has" : "does not have"} ${selectedRole.label} access.`
      });
    } catch (error) {
      app.setNotice({ type: "error", message: parseError(error) });
    }
  }

  async function grantAccess() {
    try {
      const wallet = validateWalletAddress(form.walletAddress);
      await app.runWalletWrite(`Grant ${selectedRole.label} access`, async (contract, overrides) => {
        const roleHash = await getStakeholderRoleHash(contract, form.role);
        const tx = await contract.grantRole(roleHash, wallet, overrides);
        await tx.wait();
        const hasAccess = await contract.hasRole(roleHash, wallet);
        setRoleStatus({ wallet, role: selectedRole.label, hasAccess });
        await app.refreshConnectedWalletRoles();
      });
    } catch (error) {
      app.setNotice({ type: "error", message: parseError(error) });
    }
  }

  async function removeAccess() {
    try {
      const wallet = validateWalletAddress(form.walletAddress);
      await app.runWalletWrite(`Remove ${selectedRole.label} access`, async (contract, overrides) => {
        const roleHash = await getStakeholderRoleHash(contract, form.role);
        const tx = await contract.revokeRole(roleHash, wallet, overrides);
        await tx.wait();
        const hasAccess = await contract.hasRole(roleHash, wallet);
        setRoleStatus({ wallet, role: selectedRole.label, hasAccess });
        await app.refreshConnectedWalletRoles();
      });
    } catch (error) {
      app.setNotice({ type: "error", message: parseError(error) });
    }
  }

  return (
    <section className="page-grid">
      <form className="page-card form-card" onSubmit={checkRole}>
        <p className="eyebrow">Admin Workspace</p>
        <h2>Stakeholder Access Control</h2>
        <p className="muted">
          Paste a MetaMask address, select the access role, then grant or remove access on-chain. Only an admin wallet
          can grant or revoke roles.
        </p>

        <Field label="Wallet Address">
          <input
            value={form.walletAddress}
            onChange={(event) => setForm({ ...form, walletAddress: event.target.value })}
            placeholder="0x..."
          />
        </Field>

        <Field label="Access Role">
          <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
            {stakeholderRoleOptions.map((role) => (
              <option key={role.key} value={role.key}>
                {role.label}
              </option>
            ))}
          </select>
        </Field>

        <div className="button-row role-actions">
          <button type="submit" className="secondary">
            Check Role
          </button>
          <button type="button" onClick={grantAccess}>
            Grant Access
          </button>
          <button type="button" className="danger-soft" onClick={removeAccess}>
            Remove Access
          </button>
        </div>
      </form>

      <div className="page-card">
        <p className="eyebrow">Contract RBAC</p>
        <h2>How Access Is Enforced</h2>
        <p className="muted">
          This screen calls OpenZeppelin AccessControl functions on the deployed contract. The UI can request a role
          change, but the transaction succeeds only when the connected wallet has the contract admin role.
        </p>

        {roleStatus ? (
          <div className={`role-result ${roleStatus.hasAccess ? "granted" : "missing"}`}>
            <span>{roleStatus.role}</span>
            <strong>{roleStatus.hasAccess ? "Access granted" : "Access not assigned"}</strong>
            <code className="breakable">{roleStatus.wallet}</code>
          </div>
        ) : (
          <div className="plain-result">
            <strong>No wallet checked yet.</strong>
            <p className="muted">Use Check Role to verify whether a pasted address already has the selected role.</p>
          </div>
        )}

        <div className="admin-note">
          <strong>Production pattern</strong>
          <p>
            Each stakeholder keeps their own MetaMask wallet. The admin grants the role once; after that, the
            stakeholder can connect from any computer and the contract recognizes their wallet address.
          </p>
        </div>

        <div className="warning-panel">
          <strong>Admin safety</strong>
          <p>
            Do not remove the last admin wallet. If every admin role is revoked, no one can grant or remove access
            without redeploying the contract.
          </p>
        </div>
      </div>
    </section>
  );
}

function RegisterPage({ app }) {
  const [form, setForm] = useState({
    batchId: app.activeBatchId,
    productName: "Temperature-Sensitive Vaccine Batch",
    origin: "Phoenix, AZ",
    manufactureDate: formatInputDate(Math.floor(Date.now() / 1000))
  });

  async function submit(event) {
    event.preventDefault();
    await app.runWalletWrite("Manufacturer register batch", async (contract, overrides) => {
      const batchId = form.batchId.trim();
      if (!batchId) {
        throw new Error("Batch ID is required.");
      }

      const alreadyRegistered = await contract.batchExists(batchId);
      if (alreadyRegistered) {
        throw new Error(`Batch ${batchId} is already registered. Use a new Batch ID such as BATCH${Date.now().toString().slice(-6)}.`);
      }

      const timestamp = Math.floor(new Date(form.manufactureDate).getTime() / 1000);
      const tx = await contract.registerBatch(batchId, form.productName.trim(), form.origin.trim(), timestamp, overrides);
      await tx.wait();
      app.setActiveBatchId(batchId);
      await app.refreshBatch(batchId);
      await app.refreshDashboard();
    });
  }

  return (
    <FormCard title="Register Batch" eyebrow="Manufacturer Action" onSubmit={submit}>
      <Field label="Batch ID">
        <input value={form.batchId} onChange={(event) => setForm({ ...form, batchId: event.target.value })} />
      </Field>
      <Field label="Product Name">
        <input value={form.productName} onChange={(event) => setForm({ ...form, productName: event.target.value })} />
      </Field>
      <Field label="Origin">
        <input value={form.origin} onChange={(event) => setForm({ ...form, origin: event.target.value })} />
      </Field>
      <Field label="Manufacture Date">
        <input
          type="date"
          value={form.manufactureDate}
          onChange={(event) => setForm({ ...form, manufactureDate: event.target.value })}
        />
      </Field>
      <button type="submit">Submit registerBatch()</button>
    </FormCard>
  );
}

function TransferPage({ app }) {
  const [form, setForm] = useState({
    batchId: app.activeBatchId,
    to: "",
    location: "Phoenix, AZ",
    notes: "Custody released to next stakeholder"
  });

  useEffect(() => {
    setForm((current) => ({ ...current, batchId: app.activeBatchId }));
  }, [app.activeBatchId]);

  async function submit(event) {
    event.preventDefault();
    await app.runWalletWrite("Custody transfer", async (contract, overrides) => {
      const batchId = form.batchId.trim();
      const recipient = ethers.getAddress(form.to);
      const recipientRoles = await detectWalletRoles(contract, recipient);
      const canHoldCustody = hasAnyRole(recipientRoles, ["Manufacturer", "Distributor", "Retailer"]);

      if (!canHoldCustody) {
        throw new Error(
          "Custody can only be transferred to a Manufacturer, Distributor, or Retailer wallet. Regulators review and verify without receiving shipment custody."
        );
      }

      const tx = await contract.transferCustody(batchId, recipient, form.location.trim(), form.notes.trim(), overrides);
      await tx.wait();
      setForm((current) => ({ ...current, batchId, to: recipient }));
      await app.refreshBatch(batchId);
      await app.refreshDashboard();
    });
  }

  return (
    <FormCard title="Transfer Custody" eyebrow="Current Custodian Action" onSubmit={submit}>
      <p className="muted">
        Normal custody moves only through Manufacturer, Distributor, and Retailer wallets. Regulators review, verify, and
        recall batches without receiving physical custody; admin access is an override for correcting or recovering
        custody flow.
      </p>
      <Field label="Batch ID">
        <input value={form.batchId} onChange={(event) => setForm({ ...form, batchId: event.target.value })} />
      </Field>
      <Field label="Next Custodian Address">
        <input value={form.to} onChange={(event) => setForm({ ...form, to: event.target.value })} />
      </Field>
      <Field label="Location">
        <input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} />
      </Field>
      <Field label="Notes">
        <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
      </Field>
      <button type="submit">Submit transferCustody()</button>
    </FormCard>
  );
}

function StatusPage({ app }) {
  const [form, setForm] = useState({ batchId: app.activeBatchId, status: "1", notes: "Shipment in transit" });
  const [currentBatch, setCurrentBatch] = useState(null);
  const currentStatus = currentBatch?.status ?? null;
  const connectedWallet = app.walletAddress && ethers.isAddress(app.walletAddress) ? ethers.getAddress(app.walletAddress) : "";
  const currentCustodian =
    currentBatch?.currentCustodian && ethers.isAddress(currentBatch.currentCustodian)
      ? ethers.getAddress(currentBatch.currentCustodian)
      : "";
  const isCurrentCustodian = Boolean(
    connectedWallet && currentCustodian && connectedWallet.toLowerCase() === currentCustodian.toLowerCase()
  );
  const canSubmitStatus = hasAnyRole(app.walletRoles, ["Admin"]) || isCurrentCustodian;
  const statusBlockedMessage =
    currentBatch && !canSubmitStatus
      ? `Connected wallet ${shortAddress(app.walletAddress)} is not the current custodian ${shortAddress(
          currentBatch.currentCustodian
        )}. Use the current custodian wallet or have Admin transfer custody first.`
      : "";
  const availableStatusOptions = useMemo(
    () => statusOptionsForRoles(app.walletRoles, currentStatus),
    [app.walletRoles, currentStatus]
  );

  useEffect(() => {
    setForm((current) => ({ ...current, batchId: app.activeBatchId }));
  }, [app.activeBatchId]);

  useEffect(() => {
    let isCurrent = true;

    async function loadCurrentStatus() {
      const batchId = form.batchId.trim();
      if (!app.readContract || !batchId) {
        setCurrentBatch(null);
        return;
      }

      try {
        const exists = await app.readContract.batchExists(batchId);
        if (!isCurrent) return;

        if (!exists) {
          setCurrentBatch(null);
          return;
        }

        const batch = normalizeBatch(await app.readContract.getBatch(batchId));
        if (isCurrent) {
          setCurrentBatch(batch);
        }
      } catch {
        if (isCurrent) {
          setCurrentBatch(null);
        }
      }
    }

    loadCurrentStatus();
    return () => {
      isCurrent = false;
    };
  }, [app.readContract, app.currentTrace?.batch?.status, form.batchId]);

  useEffect(() => {
    if (availableStatusOptions.length && !availableStatusOptions.some((status) => String(status.value) === form.status)) {
      setForm((current) => ({
        ...current,
        status: String(availableStatusOptions[0]?.value || 1)
      }));
    }
  }, [availableStatusOptions, form.status]);

  async function submit(event) {
    event.preventDefault();
    await app.runWalletWrite("Status update", async (contract, overrides) => {
      const cleanBatchId = form.batchId.trim();
      if (!cleanBatchId) {
        throw new Error("Enter a Batch ID before updating status.");
      }

      if (!canSubmitStatus) {
        throw new Error(statusBlockedMessage || "Only the current custodian or admin can update this batch status.");
      }

      const tx = await contract.updateStatus(cleanBatchId, Number(form.status), form.notes, overrides);
      await tx.wait();
      const trace = await app.refreshBatch(cleanBatchId);
      if (trace && !trace.notFound) {
        setCurrentBatch(trace.batch);
      }
      await app.refreshDashboard();
    });
  }

  return (
    <FormCard title="Update Status" eyebrow="Operational Lifecycle Action" onSubmit={submit}>
      <Field label="Batch ID">
        <input value={form.batchId} onChange={(event) => setForm({ ...form, batchId: event.target.value })} />
      </Field>
      <Field label="New Status">
        <select
          value={form.status}
          onChange={(event) => setForm({ ...form, status: event.target.value })}
          disabled={!availableStatusOptions.length}
        >
          {availableStatusOptions.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </select>
      </Field>
      <p className="muted">
        Current status: {currentStatus === null ? "Load or enter a registered batch ID" : statusLabels[currentStatus]}.
      </p>
      {currentBatch ? (
        <p className="muted">
          Current custodian: {shortAddress(currentBatch.currentCustodian)}. Delivered becomes available when the current
          status is Received, Stored, or Flagged.
        </p>
      ) : null}
      {statusBlockedMessage ? <div className="inline-status error">{statusBlockedMessage}</div> : null}
      <Field label="Notes">
        <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
      </Field>
      <button type="submit" disabled={!availableStatusOptions.length || Boolean(statusBlockedMessage)}>
        Submit updateStatus()
      </button>
    </FormCard>
  );
}

function ConditionsPage({ app }) {
  const [batchId, setBatchId] = useState(app.activeBatchId);
  const [scenario, setScenario] = useState("normal");
  const [file, setFile] = useState(null);
  const [logResult, setLogResult] = useState(null);
  const [processingAction, setProcessingAction] = useState("");
  const [logMessage, setLogMessage] = useState("");

  useEffect(() => setBatchId(app.activeBatchId), [app.activeBatchId]);

  async function simulate() {
    const cleanBatchId = batchId.trim();
    if (!cleanBatchId) {
      const message = "Enter a Batch ID before generating a simulated IoT log.";
      setLogMessage(message);
      app.setNotice({ type: "error", message });
      return;
    }

    setLogResult(null);
    setProcessingAction("simulate");
    setLogMessage("Generating simulated IoT log...");

    try {
      const result = buildLocalSimulationResult(cleanBatchId, scenario, 12);
      cacheLocalConditionLog(result);
      setLogResult(result);
      setBatchId(cleanBatchId);
      setLogMessage(`Simulation ready: ${result.summary}`);
      app.setNotice({ type: result.breachFlag ? "warning" : "success", message: result.summary });
    } catch (error) {
      const message = parseError(error);
      setLogMessage(message);
      app.setNotice({ type: "error", message });
    } finally {
      setProcessingAction("");
    }
  }

  async function upload() {
    const cleanBatchId = batchId.trim();
    if (!cleanBatchId) {
      const message = "Enter a Batch ID before processing an uploaded IoT log.";
      setLogMessage(message);
      app.setNotice({ type: "error", message });
      return;
    }

    if (!file) {
      const message = "Choose a JSON or CSV IoT log first.";
      setLogMessage(message);
      app.setNotice({ type: "error", message });
      return;
    }

    setLogResult(null);
    setProcessingAction("upload");
    setLogMessage("Processing uploaded IoT log...");

    try {
      const formData = new FormData();
      formData.append("batchId", cleanBatchId);
      formData.append("file", file);

      const result = await app.callBackend("/api/logs/upload", {
        method: "POST",
        body: formData
      });
      setLogResult(result);
      setBatchId(cleanBatchId);
      setLogMessage(`Upload processed: ${result.summary}`);
      app.setNotice({ type: result.breachFlag ? "warning" : "success", message: result.summary });
    } catch (error) {
      const message = parseError(error);
      setLogMessage(message);
      app.setNotice({ type: "error", message });
    } finally {
      setProcessingAction("");
    }
  }

  async function anchor() {
    if (!logResult) {
      app.setNotice({ type: "error", message: "Generate or upload a log before anchoring it on-chain." });
      return;
    }

    await app.runWalletWrite("Anchor IoT condition log", async (contract, overrides) => {
      const cleanBatchId = batchId.trim();
      if (!cleanBatchId) {
        throw new Error("Enter a Batch ID before anchoring the condition log.");
      }

      const isAdminOrRegulator = hasAnyRole(app.walletRoles, ["Admin", "Regulator"]);
      if (!isAdminOrRegulator) {
        const isLogisticsRole = hasAnyRole(app.walletRoles, ["Distributor", "Retailer"]);
        const batch = await contract.getBatch(cleanBatchId);
        const currentCustodian = tupleValue(batch, "currentCustodian", 5);
        const connectedWallet = app.walletAddress ? ethers.getAddress(app.walletAddress) : "";
        const isCurrentCustodian =
          connectedWallet &&
          ethers.isAddress(currentCustodian) &&
          ethers.getAddress(currentCustodian).toLowerCase() === connectedWallet.toLowerCase();

        if (!isLogisticsRole || !isCurrentCustodian) {
          throw new Error(
            `Only the current distributor/retailer custodian can anchor condition logs. Current custodian is ${shortAddress(
              currentCustodian
            )}; connected wallet is ${shortAddress(
              app.walletAddress
            )}. Use the current custodian wallet or transfer custody back first.`
          );
        }
      }

      const tx = await contract.recordCondition(
        cleanBatchId,
        logResult.logHash,
        logResult.logURI,
        logResult.breachFlag,
        logResult.summary,
        overrides
      );
      await tx.wait();
      setBatchId(cleanBatchId);
      await app.refreshBatch(cleanBatchId);
      await app.refreshDashboard();
    });
  }

  return (
    <section className="page-grid">
      <div className="page-card">
        <p className="eyebrow">Current Custodian Condition Action</p>
        <h2>Upload or Simulate IoT Log</h2>
        <p className="muted">
          Distributor and retailer wallets can anchor condition logs only while they are the batch's current custodian.
          Regulator and admin wallets can also add review evidence.
        </p>
        <p className="muted">
          Simulated logs are generated in the browser for a fast demo. Use JSON/CSV upload when you need a backend-stored
          off-chain file.
        </p>
        <Field label="Batch ID">
          <input value={batchId} onChange={(event) => setBatchId(event.target.value)} />
        </Field>
        <Field label="Simulation Scenario">
          <select value={scenario} onChange={(event) => setScenario(event.target.value)}>
            <option value="normal">Normal shipment</option>
            <option value="mild_breach">Mild breach</option>
            <option value="severe_breach">Severe breach</option>
          </select>
        </Field>
        <div className="button-row">
          <button type="button" onClick={simulate} disabled={Boolean(processingAction)}>
            {processingAction === "simulate" ? "Generating..." : "Generate Simulated Log"}
          </button>
          <label className="file-picker">
            {file ? file.name : "Upload JSON/CSV"}
            <input
              type="file"
              accept=".json,.csv,application/json,text/csv"
              onChange={(event) => setFile(event.target.files[0])}
            />
          </label>
          <button type="button" className="secondary" onClick={upload} disabled={Boolean(processingAction)}>
            {processingAction === "upload" ? "Processing..." : "Process Upload"}
          </button>
        </div>
        {logMessage ? (
          <div className={`inline-status${processingAction ? " working" : logResult ? " success" : " error"}`}>
            {logMessage}
          </div>
        ) : null}
      </div>

      <div className="page-card">
        <p className="eyebrow">On-chain Proof</p>
        <h2>Anchor Condition Record</h2>
        {logResult ? <LogResult result={logResult} /> : <p className="muted">No processed log yet.</p>}
        <button type="button" disabled={!logResult} onClick={anchor}>
          Submit recordCondition()
        </button>
      </div>
    </section>
  );
}

function LogResult({ result }) {
  return (
    <div className="log-result">
      <StatusBadge status={result.breachFlag ? 5 : 3} recalled={false} />
      <p>{result.summary}</p>
      <p>
        Readings: <strong>{result.readingCount}</strong> | Min: <strong>{result.minTemp ?? "n/a"}C</strong> | Max:{" "}
        <strong>{result.maxTemp ?? "n/a"}C</strong>
      </p>
      <code className="breakable">{result.logHash}</code>
      <p className="breakable">{result.logURI}</p>
    </div>
  );
}

function RegulatorPage({ app }) {
  const [form, setForm] = useState({
    batchId: app.activeBatchId,
    verificationType: "Temperature Compliance",
    result: "true",
    remarks: "Cold chain record reviewed"
  });
  const [recallReason, setRecallReason] = useState("Confirmed severe cold-chain excursion");

  useEffect(() => setForm((current) => ({ ...current, batchId: app.activeBatchId })), [app.activeBatchId]);

  async function verify(event) {
    event.preventDefault();
    await app.runWalletWrite("Regulator verification", async (contract, overrides) => {
      const tx = await contract.addVerification(
        form.batchId,
        form.verificationType,
        form.result === "true",
        form.remarks,
        overrides
      );
      await tx.wait();
      await app.refreshBatch(form.batchId);
    });
  }

  async function recall() {
    await app.runWalletWrite("Regulator recall", async (contract, overrides) => {
      const tx = await contract.recallBatch(form.batchId, recallReason, overrides);
      await tx.wait();
      await app.refreshBatch(form.batchId);
      await app.refreshDashboard();
    });
  }

  return (
    <section className="page-grid">
      <FormCard title="Add Verification" eyebrow="Regulator Action" onSubmit={verify}>
        <Field label="Batch ID">
          <input value={form.batchId} onChange={(event) => setForm({ ...form, batchId: event.target.value })} />
        </Field>
        <Field label="Verification Type">
          <input
            value={form.verificationType}
            onChange={(event) => setForm({ ...form, verificationType: event.target.value })}
          />
        </Field>
        <Field label="Result">
          <select value={form.result} onChange={(event) => setForm({ ...form, result: event.target.value })}>
            <option value="true">Approved / valid</option>
            <option value="false">Rejected / issue found</option>
          </select>
        </Field>
        <Field label="Remarks">
          <textarea value={form.remarks} onChange={(event) => setForm({ ...form, remarks: event.target.value })} />
        </Field>
        <button type="submit">Submit addVerification()</button>
      </FormCard>

      <div className="page-card">
        <p className="eyebrow">Exception Handling</p>
        <h2>Recall or Quarantine Action</h2>
        <p className="muted">
          This writes a regulator/admin recall action on-chain and keeps the batch visible with a warning.
        </p>
        <Field label="Recall Reason">
          <textarea value={recallReason} onChange={(event) => setRecallReason(event.target.value)} />
        </Field>
        <button type="button" className="danger" onClick={recall}>
          Submit recallBatch()
        </button>
      </div>
    </section>
  );
}

function TracePage({ app }) {
  const [query, setQuery] = useState(app.activeBatchId);

  async function search(event) {
    event.preventDefault();
    app.setActiveBatchId(query);
    await app.refreshBatch(query);
  }

  return (
    <section className="page-card wide">
      <form className="search-row" onSubmit={search}>
        <div>
          <p className="eyebrow">Traceability</p>
          <h2>Batch Trace / Details</h2>
        </div>
        <input value={query} onChange={(event) => setQuery(event.target.value)} />
        <button type="submit">Load Batch</button>
      </form>
      <TraceView
        trace={app.currentTrace}
        onCopy={app.copyText}
        contractAddress={app.contractAddress}
        contractExplorerUrl={app.contractExplorerUrl}
      />
    </section>
  );
}

function ConsumerVerifyPage({ app }) {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const routeBatchId = params.batchId || searchParams.get("batchId") || "";
  const [batchId, setBatchId] = useState(routeBatchId || app.activeBatchId);
  const [trace, setTrace] = useState(null);

  useEffect(() => {
    if (routeBatchId && app.readContract) {
      loadBatchTrace(app.readContract, routeBatchId)
        .then(setTrace)
        .catch((error) => app.setNotice({ type: "error", message: parseError(error) }));
    }
  }, [app.readContract, routeBatchId]);

  async function verify(event) {
    event.preventDefault();
    try {
      const result = await loadBatchTrace(app.readContract, batchId);
      setTrace(result);
    } catch (error) {
      app.setNotice({ type: "error", message: parseError(error) });
    }
  }

  return (
    <section className="page-card wide consumer-page">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Public Read-only Verification</p>
          <h2>Consumer Batch Check</h2>
          <p className="muted">
            A simplified public view for patients, buyers, or receiving staff. This page does not require MetaMask.
          </p>
        </div>
      </div>

      <form className="search-row" onSubmit={verify}>
        <input value={batchId} onChange={(event) => setBatchId(event.target.value)} placeholder="Enter batch ID" />
        <button type="submit">Verify Batch</button>
      </form>

      <ConsumerSummary trace={trace} />
    </section>
  );
}

function TamperCheckPage({ app }) {
  const [batchId, setBatchId] = useState(app.activeBatchId);
  const [filename, setFilename] = useState("");
  const [expectedHash, setExpectedHash] = useState("");
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loadedProof, setLoadedProof] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    setBatchId(app.activeBatchId);
  }, [app.activeBatchId]);

  async function populateFromBatch() {
    const cleanedBatchId = batchId.trim();
    if (!cleanedBatchId) {
      throw new Error("Enter a Batch ID first.");
    }

    if (!app.readContract) {
      throw new Error("Blockchain read contract is not ready yet.");
    }

    const trace = await loadBatchTrace(app.readContract, cleanedBatchId);
    if (trace?.notFound) {
      throw new Error(`Batch ${cleanedBatchId} is not registered.`);
    }

    const latestCondition = trace.conditions.at(-1);
    if (!latestCondition) {
      throw new Error(`Batch ${cleanedBatchId} does not have any anchored condition logs yet.`);
    }

    const storedFilename = filenameFromLogUri(latestCondition.logURI);
    setExpectedHash(latestCondition.logHash);
    setFilename(storedFilename);
    setLoadedProof(latestCondition);
    setResult(null);
    app.setNotice({ type: "success", message: `Loaded latest condition proof for ${cleanedBatchId}.` });
    return { ...latestCondition, storedFilename };
  }

  async function loadProofFromBatch() {
    try {
      await populateFromBatch();
    } catch (error) {
      app.setNotice({ type: "error", message: parseError(error) });
    }
  }

  async function verify(event) {
    event.preventDefault();
    const options = { method: "POST" };
    setIsVerifying(true);
    setResult(null);
    app.setNotice({ type: "info", message: "Checking off-chain log hash against the anchored digest..." });

    try {
      let hashToCheck = expectedHash.trim();
      let filenameToCheck = filename.trim();
      let proofForCheck = loadedProof;

      if (!hashToCheck || (!file && !filenameToCheck)) {
        const proof = await populateFromBatch();
        hashToCheck = proof.logHash;
        filenameToCheck = proof.storedFilename;
        proofForCheck = proof;
      }

      if (file) {
        const response = await verifyBrowserFileHash(file, hashToCheck);
        setResult(response);
        app.setNotice({
          type: response.isMatch ? "success" : "warning",
          message:
            response.message || (response.isMatch ? "MATCH: off-chain file is authentic." : "MISMATCH: file was changed.")
        });
        return;
      }

      const cachedLog = getCachedLocalConditionLog(filenameToCheck);
      if (cachedLog) {
        const response = verifyCachedConditionLogHash(cachedLog, hashToCheck);
        setResult(response);
        app.setNotice({
          type: response.isMatch ? "success" : "warning",
          message:
            response.message || (response.isMatch ? "MATCH: off-chain file is authentic." : "MISMATCH: file was changed.")
        });
        return;
      }

      if (String(proofForCheck?.logURI || "").includes("/simulated-logs/")) {
        throw new Error(
          "This proof was generated as a browser simulation, but the raw log is not cached in this browser. Generate and anchor a new simulated log here, or choose the original JSON file."
        );
      }

      if (filenameToCheck) {
        options.headers = { "Content-Type": "application/json" };
        options.body = JSON.stringify({ filename: filenameToCheck, expectedHash: hashToCheck });
      } else {
        throw new Error("Provide either a file or a stored filename.");
      }

      const response = await app.callBackend("/api/logs/verify", options);
      setResult(response);
      app.setNotice({
        type: response.isMatch ? "success" : "warning",
        message: response.message || (response.isMatch ? "MATCH: off-chain file is authentic." : "MISMATCH: file was changed.")
      });
    } catch (error) {
      const message = parseError(error);
      setResult({
        error: true,
        isMatch: false,
        message
      });
      app.setNotice({ type: "error", message });
    } finally {
      setIsVerifying(false);
    }
  }

  return (
    <section className="page-grid">
      <form className="page-card" onSubmit={verify}>
        <p className="eyebrow">Tamper Evidence</p>
        <h2>Verify Off-chain Log Hash</h2>
        <p className="muted">
          Enter a Batch ID to load the latest anchored condition proof. Browser-generated demo logs verify instantly when
          they were generated in this browser; otherwise choose the original JSON/CSV file.
        </p>
        <Field label="Batch ID">
          <input value={batchId} onChange={(event) => setBatchId(event.target.value)} placeholder="BATCH001" />
        </Field>
        <button type="button" className="secondary" onClick={loadProofFromBatch}>
          Load Latest Condition Proof
        </button>
        {loadedProof ? (
          <div className={`plain-result ${loadedProof.breachFlag ? "warning" : ""}`}>
            <strong>{loadedProof.breachFlag ? "Breach proof loaded" : "Condition proof loaded"}</strong>
            <p>{loadedProof.summary}</p>
          </div>
        ) : null}
        <Field label="Expected On-chain Hash">
          <input value={expectedHash} onChange={(event) => setExpectedHash(event.target.value)} />
        </Field>
        <Field label="Stored Filename">
          <input value={filename} onChange={(event) => setFilename(event.target.value)} placeholder="BATCH001-normal.json" />
        </Field>
        <label className="file-picker">
          Or choose modified/original file
          <input type="file" onChange={(event) => setFile(event.target.files[0])} />
        </label>
        <button type="submit" disabled={isVerifying}>
          {isVerifying ? "Checking Hash..." : "Run Hash Verification"}
        </button>
      </form>

      <div className="page-card">
        <h2>Verification Result</h2>
        {isVerifying ? (
          <div className="plain-result">
            <strong>Checking hash...</strong>
            <p>Reading the off-chain log and recomputing the digest.</p>
          </div>
        ) : result ? (
          <div className={result.isMatch ? "match-result" : "mismatch-result"}>
            <strong>{result.error ? "Verification request failed" : result.isMatch ? "MATCH" : "MISMATCH"}</strong>
            <p>{result.message}</p>
            {result.expectedHash ? <code className="breakable">Expected: {result.expectedHash}</code> : null}
            {result.recomputedHash ? <code className="breakable">Recomputed: {result.recomputedHash}</code> : null}
          </div>
        ) : (
          <p className="muted">Run a check to compare a file against the anchored digest.</p>
        )}
      </div>
    </section>
  );
}

function DemoFlowPage({ app }) {
  return (
    <section className="page-grid">
      <div className="page-card wide">
        <p className="eyebrow">Sandbox Runbook</p>
        <h2>End-to-End Stakeholder Workflow</h2>
        <p>
          This runbook is for local validation only. In production, each organization connects its own wallet and
          signs only the transactions allowed by its contract role.
        </p>
        <div className="workflow-strip">
          <span>Admin grants roles</span>
          <span>Manufacturer registers</span>
          <span>Distributor ships + logs condition</span>
          <span>Retailer delivers</span>
          <span>Regulator verifies or recalls</span>
          <span>Consumer checks public trace</span>
        </div>
      </div>
      <div className="page-card">
        <h2>Action Feed</h2>
        <ul className="activity-list">
          {app.activity.map((item, index) => (
            <li key={`${item}-${index}`}>{item}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function FormCard({ title, eyebrow, onSubmit, children }) {
  return (
    <form className="page-card form-card" onSubmit={onSubmit}>
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {children}
    </form>
  );
}

function ColdChainApp() {
  const [rpcUrl, setRpcUrl] = useState(DEFAULT_RPC_URL);
  const [backendUrl, setBackendUrl] = useState(DEFAULT_BACKEND_URL);
  const [contractAddress, setContractAddress] = useState(DEFAULT_CONTRACT_ADDRESS);
  const [activeBatchId, setActiveBatchId] = useState("BATCH001");
  const [readContract, setReadContract] = useState(null);
  const [signerContract, setSignerContract] = useState(null);
  const [walletAddress, setWalletAddress] = useState("");
  const [walletRoles, setWalletRoles] = useState([]);
  const [networkStatus, setNetworkStatus] = useState("Standby");
  const [notice, setNotice] = useState(null);
  const [currentTrace, setCurrentTrace] = useState(null);
  const [batches, setBatches] = useState([]);
  const [activity, setActivity] = useState([]);
  const [stakeholders, setStakeholders] = useState([
    { role: "Admin", address: "", privateKey: "" },
    { role: "Manufacturer", address: "", privateKey: "" },
    { role: "Distributor", address: "", privateKey: "" },
    { role: "Retailer", address: "", privateKey: "" },
    { role: "Regulator", address: "", privateKey: "" },
    { role: "Consumer", address: "", privateKey: "" }
  ]);

  useEffect(() => {
    fetch("/demo-contract.json")
      .then((response) => (response.ok ? response.json() : null))
      .then((deployment) => {
        if (deployment?.contractAddress && !import.meta.env.VITE_CONTRACT_ADDRESS) {
          setContractAddress(deployment.contractAddress);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!ethers.isAddress(contractAddress)) {
      setReadContract(null);
      return;
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    setReadContract(new ethers.Contract(contractAddress, supplyChainAbi, provider));
  }, [contractAddress, rpcUrl]);

  useEffect(() => {
    const ethereum = window.ethereum;
    if (!ethereum?.on) return undefined;

    const handleAccountsChanged = (accounts = []) => {
      startTransition(() => {
        if (!accounts.length) {
          setWalletAddress("");
          setWalletRoles([]);
          setSignerContract(null);
          setNetworkStatus(readContract ? "Read-only" : "Standby");
          setNotice({ type: "warning", message: "MetaMask disconnected. Public read-only access remains available." });
          return;
        }

        connectWallet({ requestAccounts: false });
      });
    };

    ethereum.on("accountsChanged", handleAccountsChanged);
    return () => ethereum.removeListener?.("accountsChanged", handleAccountsChanged);
  }, [contractAddress, readContract]);

  function addActivity(message) {
    const line = `${new Date().toLocaleTimeString()} - ${message}`;
    startTransition(() => {
      setActivity((items) => [line, ...items].slice(0, 12));
    });
  }

  async function callBackend(path, options) {
    const response = await fetch(`${backendUrl}${path}`, options);
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await response.json()
      : { message: await response.text() };
    if (!response.ok) {
      throw new Error(payload.message || `Backend request failed with status ${response.status}`);
    }
    return payload;
  }

  async function copyText(value, label = "value") {
    if (!value) return;
    await navigator.clipboard?.writeText(value);
    setNotice({ type: "success", message: `Copied ${label}.` });
  }

  async function refreshBatch(batchId = activeBatchId) {
    try {
      const trace = await loadBatchTrace(readContract, batchId);
      setCurrentTrace(trace);
      if (trace && !trace.notFound) {
        addActivity(`Loaded trace for ${batchId}.`);
      }
      return trace;
    } catch (error) {
      setNotice({ type: "error", message: parseError(error) });
      return null;
    }
  }

  async function loadDashboardFromContract(contract, { silent = false } = {}) {
    if (!contract) return;

    try {
      const ids = await contract.getAllBatchIds();
      const traces = await Promise.all(ids.map((id) => loadBatchTrace(contract, id)));
      setBatches(traces.filter((trace) => trace && !trace.notFound));
      if (!silent) {
        addActivity(`Dashboard loaded ${ids.length} batch record(s).`);
      }
    } catch (error) {
      setNotice({ type: "error", message: parseError(error) });
    }
  }

  async function refreshDashboard() {
    await loadDashboardFromContract(readContract);
  }

  useEffect(() => {
    if (!readContract) return undefined;

    let cancelled = false;
    setNetworkStatus((current) => (current === "Standby" ? "Read-only" : current));
    loadDashboardFromContract(readContract, { silent: true });
    loadBatchTrace(readContract, activeBatchId)
      .then((trace) => {
        if (!cancelled) {
          setCurrentTrace(trace);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [readContract, activeBatchId]);

  async function connectWallet({ requestAccounts = true } = {}) {
    try {
      if (!window.ethereum) {
        throw new Error("MetaMask is not available. Install MetaMask to use stakeholder wallet access.");
      }

      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      if (requestAccounts) {
        await browserProvider.send("eth_requestAccounts", []);
      } else {
        const accounts = await browserProvider.send("eth_accounts", []);
        if (!accounts.length) {
          throw new Error("No MetaMask account is connected.");
        }
      }

      let network = await browserProvider.getNetwork();
      let activeContractAddress = contractAddress;
      const useLocalSandbox = isLocalSandboxConnection({
        chainId: network.chainId,
        rpcUrl,
        contractAddress,
        networkStatus
      });
      const usePolygonAmoy = !useLocalSandbox && isPolygonAmoyConnection({ rpcUrl, contractAddress });

      if (useLocalSandbox) {
        const sandbox = await loadLocalSandboxConnection();
        activeContractAddress = sandbox.sandboxContractAddress;
      }

      if (!ethers.isAddress(activeContractAddress)) {
        throw new Error("Set a valid contract address before connecting a stakeholder wallet.");
      }

      if (usePolygonAmoy && network.chainId !== POLYGON_AMOY_CHAIN_ID) {
        await switchToPolygonAmoy(browserProvider);
        network = await browserProvider.getNetwork();

        if (network.chainId !== POLYGON_AMOY_CHAIN_ID) {
          throw new Error("Switch MetaMask to Polygon Amoy Testnet before connecting this live stakeholder wallet.");
        }
      }

      const roleProvider = useLocalSandbox
        ? new ethers.JsonRpcProvider(LOCAL_SANDBOX_RPC_URL)
        : usePolygonAmoy
          ? new ethers.JsonRpcProvider(rpcUrl)
          : browserProvider;
      const deployedCode = await roleProvider.getCode(activeContractAddress);
      if (deployedCode === "0x") {
        throw new Error(
          useLocalSandbox
            ? `No local sandbox contract found at ${activeContractAddress}. Run npm run deploy:local, then click Connect Sandbox Network.`
            : `No deployed contract found at ${activeContractAddress} on the selected MetaMask network.`
        );
      }

      const signer = await browserProvider.getSigner();
      const address = await signer.getAddress();
      const contract = new ethers.Contract(activeContractAddress, supplyChainAbi, signer);
      const roleContract = new ethers.Contract(activeContractAddress, supplyChainAbi, roleProvider);
      const roles = await detectWalletRoles(roleContract, address);
      setWalletAddress(address);
      setWalletRoles(roles);
      setSignerContract(contract);
      setNetworkStatus("Wallet connected");
      setNotice({
        type: "success",
        message: roles.length
          ? `Connected ${shortAddress(address)} as ${roles.join(", ")}.`
          : `Connected ${shortAddress(address)}. No stakeholder role is assigned yet.`
      });
    } catch (error) {
      setNotice({ type: "error", message: parseError(error) });
    }
  }

  async function disconnectWallet() {
    const disconnectedAddress = walletAddress;

    try {
      if (window.ethereum?.request) {
        await window.ethereum.request({
          method: "wallet_revokePermissions",
          params: [{ eth_accounts: {} }]
        });
      }
    } catch {
      // Some wallets do not support programmatic disconnect. The app session is still cleared below.
    }

    setWalletAddress("");
    setWalletRoles([]);
    setSignerContract(null);
    setNetworkStatus(readContract ? "Read-only" : "Standby");
    setNotice({
      type: "success",
      message: disconnectedAddress
        ? `Logged out ${shortAddress(disconnectedAddress)}. Public verification remains available.`
        : "No stakeholder wallet is connected."
    });

    if (disconnectedAddress) {
      addActivity(`Logged out ${shortAddress(disconnectedAddress)} from this browser session.`);
    }
  }

  async function refreshConnectedWalletRoles() {
    if (!signerContract || !walletAddress) {
      return [];
    }

    const roles = await detectWalletRoles(signerContract, walletAddress);
    setWalletRoles(roles);
    return roles;
  }

  async function getWriteOverrides(contract = signerContract) {
    const provider = contract?.runner?.provider;
    if (!provider?.getNetwork) return {};

    const network = await provider.getNetwork();
    if (network.chainId !== POLYGON_AMOY_CHAIN_ID) {
      return {};
    }

    return {
      maxPriorityFeePerGas: ethers.parseUnits("35", "gwei"),
      maxFeePerGas: ethers.parseUnits("60", "gwei")
    };
  }

  async function requireGasBalance(contract = signerContract) {
    const provider = contract?.runner?.provider;
    if (!provider?.getNetwork || !walletAddress) return;

    const network = await provider.getNetwork();
    if (network.chainId !== POLYGON_AMOY_CHAIN_ID) return;

    const balance = await provider.getBalance(walletAddress);
    if (balance === 0n) {
      throw new Error("This stakeholder wallet has 0 POL on Polygon Amoy. Add test POL before submitting an on-chain transaction.");
    }
  }

  async function loadLocalSandboxConnection() {
    const response = await fetch(`/demo-contract.json?cache=${Date.now()}`).catch(() => null);
    const deployment = response?.ok ? await response.json() : null;
    const sandboxContractAddress = deployment?.contractAddress || LOCAL_SANDBOX_CONTRACT_ADDRESS;

    setRpcUrl(LOCAL_SANDBOX_RPC_URL);
    setContractAddress(sandboxContractAddress);

    return {
      sandboxRpcUrl: LOCAL_SANDBOX_RPC_URL,
      sandboxContractAddress
    };
  }

  async function getLocalActors(localRpcUrl = rpcUrl) {
    const provider = new ethers.JsonRpcProvider(localRpcUrl);
    const signers = await Promise.all([0, 1, 2, 3, 4, 5].map((index) => provider.getSigner(index)));
    const addresses = await Promise.all(signers.map((signer) => signer.getAddress()));
    setStakeholders([
      { role: "Admin", address: addresses[0], privateKey: localSandboxTestKey(0) },
      { role: "Manufacturer", address: addresses[1], privateKey: localSandboxTestKey(1) },
      { role: "Distributor", address: addresses[2], privateKey: localSandboxTestKey(2) },
      { role: "Retailer", address: addresses[3], privateKey: localSandboxTestKey(3) },
      { role: "Regulator", address: addresses[4], privateKey: localSandboxTestKey(4) },
      { role: "Consumer", address: addresses[5], privateKey: localSandboxTestKey(5) }
    ]);

    return {
      provider,
      admin: signers[0],
      manufacturer: signers[1],
      distributor: signers[2],
      retailer: signers[3],
      regulator: signers[4],
      consumer: signers[5],
      addresses
    };
  }

  function contractFor(signer) {
    return new ethers.Contract(contractAddress, supplyChainAbi, signer);
  }

  async function connectLocalNetwork() {
    try {
      const { sandboxRpcUrl, sandboxContractAddress } = await loadLocalSandboxConnection();
      const actors = await getLocalActors(sandboxRpcUrl);
      await actors.provider.getBlockNumber();
      const code = await actors.provider.getCode(sandboxContractAddress);
      if (code === "0x") {
        throw new Error(`No local contract found at ${sandboxContractAddress}. Run npm run deploy:local after npm run node.`);
      }
      setReadContract(new ethers.Contract(sandboxContractAddress, supplyChainAbi, actors.provider));
      setNetworkStatus("Local Hardhat");
      setNotice({
        type: "success",
        message: `Connected to local Hardhat RPC and contract ${shortAddress(sandboxContractAddress)}.`
      });
      addActivity(`Connected to local RPC at ${sandboxRpcUrl}.`);
    } catch (error) {
      setNotice({ type: "error", message: parseError(error) });
    }
  }

  async function grantDemoRoles() {
    try {
      const { sandboxRpcUrl, sandboxContractAddress } = await loadLocalSandboxConnection();
      const actors = await getLocalActors(sandboxRpcUrl);
      const contract = new ethers.Contract(sandboxContractAddress, supplyChainAbi, actors.admin);
      const [manufacturerRole, distributorRole, retailerRole, regulatorRole] = await Promise.all([
        contract.MANUFACTURER_ROLE(),
        contract.DISTRIBUTOR_ROLE(),
        contract.RETAILER_ROLE(),
        contract.REGULATOR_ROLE()
      ]);

      await (await contract.grantRole(manufacturerRole, actors.addresses[1])).wait();
      await (await contract.grantRole(distributorRole, actors.addresses[2])).wait();
      await (await contract.grantRole(retailerRole, actors.addresses[3])).wait();
      await (await contract.grantRole(regulatorRole, actors.addresses[4])).wait();

      setNotice({ type: "success", message: "Stakeholder roles granted to local demo accounts." });
      addActivity("Admin granted stakeholder roles.");
    } catch (error) {
      setNotice({ type: "error", message: parseError(error) });
    }
  }

  async function demoRegisterBatch() {
    try {
      const actors = await getLocalActors();
      const contract = contractFor(actors.manufacturer);
      const tx = await contract.registerBatch(
        activeBatchId,
        "Temperature-Sensitive Vaccine Batch",
        "Phoenix, AZ",
        Math.floor(Date.now() / 1000)
      );
      await tx.wait();
      await refreshBatch(activeBatchId);
      await refreshDashboard();
      setNotice({ type: "success", message: `Manufacturer registered ${activeBatchId}.` });
      addActivity(`Manufacturer registered ${activeBatchId}.`);
    } catch (error) {
      setNotice({ type: "error", message: parseError(error) });
    }
  }

  async function demoSendToDistributor() {
    try {
      const actors = await getLocalActors();
      const manufacturerContract = contractFor(actors.manufacturer);
      const distributorContract = contractFor(actors.distributor);

      await (
        await manufacturerContract.transferCustody(
          activeBatchId,
          actors.addresses[2],
          "Phoenix, AZ",
          "Released to distributor"
        )
      ).wait();
      await (await distributorContract.updateStatus(activeBatchId, 1, "Shipment in transit")).wait();

      let logResult;
      try {
        logResult = await callBackend("/api/logs/simulate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ batchId: activeBatchId, scenario: "normal" })
        });
      } catch {
        logResult = {
          logHash: ethers.keccak256(ethers.toUtf8Bytes(`${activeBatchId}-normal-fallback`)),
          logURI: `backend/src/uploads/${activeBatchId}-normal.json`,
          breachFlag: false,
          summary: "12 readings, max 7.6C, compliant"
        };
      }

      await (
        await distributorContract.recordCondition(
          activeBatchId,
          logResult.logHash,
          logResult.logURI,
          logResult.breachFlag,
          logResult.summary
        )
      ).wait();

      await refreshBatch(activeBatchId);
      await refreshDashboard();
      setNotice({ type: "success", message: "Distributor received custody and anchored a normal condition log." });
      addActivity("Distributor received custody, marked shipment, and anchored condition log.");
    } catch (error) {
      setNotice({ type: "error", message: parseError(error) });
    }
  }

  async function demoDeliverAndVerify() {
    try {
      const actors = await getLocalActors();
      const distributorContract = contractFor(actors.distributor);
      const retailerContract = contractFor(actors.retailer);
      const regulatorContract = contractFor(actors.regulator);

      await (
        await distributorContract.transferCustody(activeBatchId, actors.addresses[3], "Tempe, AZ", "Delivered to retailer")
      ).wait();
      await (await retailerContract.updateStatus(activeBatchId, 2, "Retailer received shipment")).wait();
      await (await retailerContract.updateStatus(activeBatchId, 4, "Delivered and ready for dispensing")).wait();
      await (
        await regulatorContract.addVerification(
          activeBatchId,
          "Temperature Compliance",
          true,
          "Cold chain log reviewed and approved"
        )
      ).wait();

      await refreshBatch(activeBatchId);
      await refreshDashboard();
      setNotice({ type: "success", message: "Retailer delivered the batch and regulator verified compliance." });
      addActivity("Retailer delivered the batch; regulator added compliance verification.");
    } catch (error) {
      setNotice({ type: "error", message: parseError(error) });
    }
  }

  async function demoBreachAndRecall() {
    const breachBatchId = "BATCH002";
    try {
      const actors = await getLocalActors();
      const adminContract = contractFor(actors.admin);
      const manufacturerContract = contractFor(actors.manufacturer);
      const distributorContract = contractFor(actors.distributor);
      const regulatorContract = contractFor(actors.regulator);
      const exists = await adminContract.batchExists(breachBatchId);

      if (!exists) {
        await (
          await manufacturerContract.registerBatch(
            breachBatchId,
            "High-risk Biologic Shipment",
            "Mesa, AZ",
            Math.floor(Date.now() / 1000)
          )
        ).wait();
        await (
          await manufacturerContract.transferCustody(breachBatchId, actors.addresses[2], "Mesa, AZ", "Released to distributor")
        ).wait();
        await (await distributorContract.updateStatus(breachBatchId, 1, "Shipment in transit")).wait();
      }

      let logResult;
      try {
        logResult = await callBackend("/api/logs/simulate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ batchId: breachBatchId, scenario: "severe_breach" })
        });
      } catch {
        logResult = {
          logHash: ethers.keccak256(ethers.toUtf8Bytes(`${breachBatchId}-severe-fallback`)),
          logURI: `backend/src/uploads/${breachBatchId}-severe.json`,
          breachFlag: true,
          summary: "12 readings, max 12.3C, breach detected"
        };
      }

      await (
        await distributorContract.recordCondition(
          breachBatchId,
          logResult.logHash,
          logResult.logURI,
          true,
          logResult.summary
        )
      ).wait();
      await (await regulatorContract.recallBatch(breachBatchId, "Severe temperature excursion confirmed")).wait();

      setActiveBatchId(breachBatchId);
      await refreshBatch(breachBatchId);
      await refreshDashboard();
      setNotice({ type: "warning", message: "Breach shipment was flagged and recalled." });
      addActivity("Severe breach log anchored; regulator recalled BATCH002.");
    } catch (error) {
      setNotice({ type: "error", message: parseError(error) });
    }
  }

  async function demoUnauthorizedAction() {
    try {
      const actors = await getLocalActors();
      const consumerContract = contractFor(actors.consumer);
      await consumerContract.addVerification(activeBatchId, "Unauthorized Review", true, "Should fail");
      setNotice({ type: "error", message: "Unexpected success: unauthorized action was not rejected." });
    } catch (error) {
      setNotice({ type: "success", message: `Unauthorized action rejected: ${parseError(error)}` });
      addActivity("Unauthorized consumer verification attempt was rejected by the contract.");
    }
  }

  async function runWalletWrite(label, action) {
    try {
      if (!signerContract) {
        throw new Error("Connect MetaMask first with the stakeholder wallet assigned to this role.");
      }
      await requireGasBalance(signerContract);
      const overrides = await getWriteOverrides(signerContract);
      await action(signerContract, overrides);
      setNotice({ type: "success", message: `${label} completed.` });
      addActivity(`${label} completed from connected wallet.`);
    } catch (error) {
      setNotice({ type: "error", message: parseError(error) });
    }
  }

  const activeContractExplorerUrl = contractExplorerUrl({ contractAddress, rpcUrl, networkStatus });

  const app = {
    rpcUrl,
    setRpcUrl,
    backendUrl,
    setBackendUrl,
    contractAddress,
    contractExplorerUrl: activeContractExplorerUrl,
    setContractAddress,
    activeBatchId,
    setActiveBatchId,
    readContract,
    walletAddress,
    walletRoles,
    networkStatus,
    notice,
    setNotice,
    currentTrace,
    batches,
    activity,
    stakeholders,
    connectWallet,
    disconnectWallet,
    connectLocalNetwork,
    grantDemoRoles,
    demoRegisterBatch,
    demoSendToDistributor,
    demoDeliverAndVerify,
    demoBreachAndRecall,
    demoUnauthorizedAction,
    refreshBatch,
    refreshDashboard,
    refreshConnectedWalletRoles,
    runWalletWrite,
    callBackend,
    copyText
  };

  return (
    <Layout app={app}>
      <Routes>
        <Route path="/" element={<DashboardPage app={app} />} />
        <Route
          path="/admin/access"
          element={
            <AccessGate app={app} item={navByPath["/admin/access"]}>
              <AdminAccessPage app={app} />
            </AccessGate>
          }
        />
        <Route
          path="/register"
          element={
            <AccessGate app={app} item={navByPath["/register"]}>
              <RegisterPage app={app} />
            </AccessGate>
          }
        />
        <Route
          path="/transfer"
          element={
            <AccessGate app={app} item={navByPath["/transfer"]}>
              <TransferPage app={app} />
            </AccessGate>
          }
        />
        <Route
          path="/status"
          element={
            <AccessGate app={app} item={navByPath["/status"]}>
              <StatusPage app={app} />
            </AccessGate>
          }
        />
        <Route
          path="/conditions"
          element={
            <AccessGate app={app} item={navByPath["/conditions"]}>
              <ConditionsPage app={app} />
            </AccessGate>
          }
        />
        <Route
          path="/regulator"
          element={
            <AccessGate app={app} item={navByPath["/regulator"]}>
              <RegulatorPage app={app} />
            </AccessGate>
          }
        />
        <Route path="/trace" element={<TracePage app={app} />} />
        <Route path="/verify" element={<ConsumerVerifyPage app={app} />} />
        <Route path="/verify/:batchId" element={<ConsumerVerifyPage app={app} />} />
        <Route path="/tamper" element={<TamperCheckPage app={app} />} />
        <Route path="/demo" element={<DemoFlowPage app={app} />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  const baseName = import.meta.env.BASE_URL === "/" ? undefined : import.meta.env.BASE_URL;

  return (
    <BrowserRouter basename={baseName}>
      <ColdChainApp />
    </BrowserRouter>
  );
}
