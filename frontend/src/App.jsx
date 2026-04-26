import React, { useEffect, useMemo, useState, startTransition } from "react";
import { BrowserRouter, NavLink, Route, Routes, useParams, useSearchParams } from "react-router-dom";
import { ethers } from "ethers";
import { QRCodeSVG } from "qrcode.react";
import { statusLabels, supplyChainAbi } from "./contractAbi";
import "./styles.css";

const DEFAULT_RPC_URL = import.meta.env.VITE_RPC_URL || "http://127.0.0.1:8545";
const DEFAULT_BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? "http://localhost:4000" : "");
const DEFAULT_CONTRACT_ADDRESS =
  import.meta.env.VITE_CONTRACT_ADDRESS || (import.meta.env.DEV ? "0x5FbDB2315678afecb367f032d93F642f64180aa3" : "");
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const STATUS_OPTIONS = statusLabels
  .map((label, value) => ({ label, value }))
  .filter((status) => status.value > 0 && status.value < 6);

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
    roles: ["Admin", "Manufacturer", "Distributor", "Retailer"],
    sidebarLabel: "Custody Transfer"
  },
  {
    label: "Status Update",
    to: "/status",
    roles: ["Admin", "Manufacturer", "Distributor", "Retailer"],
    sidebarLabel: "Status Update"
  },
  {
    label: "Condition Logs",
    to: "/conditions",
    roles: ["Admin", "Distributor", "Retailer", "Regulator"],
    sidebarLabel: "Condition Logs"
  },
  { label: "Regulator Review", to: "/regulator", roles: ["Regulator"], sidebarLabel: "Regulator Review" },
  { label: "Batch Trace", to: "/trace", sidebarLabel: "Batch Trace" },
  { label: "Consumer Verify", to: "/verify", sidebarLabel: "Consumer Verification" },
  { label: "Tamper Check", to: "/tamper", sidebarLabel: "Tamper Evidence" }
];

const navByPath = Object.fromEntries(navItems.map((item) => [item.to, item]));

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

function parseError(error) {
  const message = error?.shortMessage || error?.reason || error?.message || "Unexpected error";
  return message.replace(/^execution reverted: /i, "");
}

function appUrl(path) {
  const base = import.meta.env.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  return `${window.location.origin}${normalizedBase}${normalizedPath}`;
}

function validateWalletAddress(address) {
  if (!ethers.isAddress(address)) {
    throw new Error("Enter a valid MetaMask wallet address.");
  }

  return ethers.getAddress(address);
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
    batchId: batch.batchId,
    productName: batch.productName,
    origin: batch.origin,
    manufactureDate: Number(batch.manufactureDate),
    manufacturer: batch.manufacturer,
    currentCustodian: batch.currentCustodian,
    status: Number(batch.status),
    exists: batch.exists,
    recalled: batch.recalled,
    lastStatusNote: batch.lastStatusNote
  };
}

function normalizeHistoryItem(item) {
  return {
    ...item,
    timestamp: Number(item.timestamp)
  };
}

function normalizeRecall(recall) {
  return {
    isRecalled: recall.isRecalled,
    reason: recall.reason,
    timestamp: Number(recall.timestamp),
    actionBy: recall.actionBy
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

  return {
    batch: normalizeBatch(batch),
    custody: custody.map(normalizeHistoryItem),
    conditions: conditions.map(normalizeHistoryItem),
    verifications: verifications.map(normalizeHistoryItem),
    recall: normalizeRecall(recall)
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
          {app.walletAddress ? "Switch Stakeholder Wallet" : "Connect Stakeholder Wallet"}
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

function AddressLine({ label, address, onCopy }) {
  return (
    <div className="address-line">
      <span>{label}</span>
      <code title={address}>{address || "Not set"}</code>
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

function TraceView({ trace, onCopy }) {
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

        <div className="address-grid">
          <AddressLine label="Manufacturer" address={batch.manufacturer} onCopy={onCopy} />
          <AddressLine label="Current custodian" address={batch.currentCustodian} onCopy={onCopy} />
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

function Layout({ app, children }) {
  const visibleNavItems = navItems.filter((item) => canAccessNavItem(item, app.walletRoles));
  const visibleWorkspaceItems = visibleNavItems.filter((item) => item.sidebarLabel && item.to !== "/");

  return (
    <div className="app-shell">
      <aside className="side-rail" aria-label="Control sidebar">
        <div className="brand-mark">
          <span>CC</span>
          <div>
            <strong>ColdChain</strong>
            <small>Provenance</small>
          </div>
        </div>

        <div className="rail-section stakeholder-session">
          <p className="eyebrow">Stakeholder Access</p>
          <div className="session-card">
            <span>Connected organization</span>
            <strong>{app.walletAddress ? shortAddress(app.walletAddress) : "No wallet connected"}</strong>
            <p>{stakeholderSessionText(app.walletRoles, app.walletAddress)}</p>
            {app.walletAddress ? (
              <div className="session-actions">
                <button type="button" className="secondary" onClick={app.connectWallet}>
                  Switch Wallet
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
          <button type="button" onClick={() => app.refreshBatch(app.activeBatchId)}>
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
          <p className="eyebrow">Sandbox Accounts</p>
          {app.stakeholders.map((stakeholder) => (
            <div className="wallet-row" key={stakeholder.role}>
              <strong>{stakeholder.role}</strong>
              <code>{shortAddress(stakeholder.address)}</code>
              <button type="button" className="ghost small" onClick={() => app.copyText(stakeholder.address, stakeholder.role)}>
                Copy
              </button>
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
            {app.walletAddress ? (
              <div className="hero-wallet-actions">
                <button type="button" onClick={app.connectWallet}>
                  Switch Stakeholder Wallet
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
      await app.runWalletWrite(`Grant ${selectedRole.label} access`, async (contract) => {
        const roleHash = await getStakeholderRoleHash(contract, form.role);
        const tx = await contract.grantRole(roleHash, wallet);
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
      await app.runWalletWrite(`Remove ${selectedRole.label} access`, async (contract) => {
        const roleHash = await getStakeholderRoleHash(contract, form.role);
        const tx = await contract.revokeRole(roleHash, wallet);
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
    await app.runWalletWrite("Manufacturer register batch", async (contract) => {
      const timestamp = Math.floor(new Date(form.manufactureDate).getTime() / 1000);
      const tx = await contract.registerBatch(form.batchId, form.productName, form.origin, timestamp);
      await tx.wait();
      app.setActiveBatchId(form.batchId);
      await app.refreshBatch(form.batchId);
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
    await app.runWalletWrite("Custody transfer", async (contract) => {
      const tx = await contract.transferCustody(form.batchId, form.to, form.location, form.notes);
      await tx.wait();
      await app.refreshBatch(form.batchId);
      await app.refreshDashboard();
    });
  }

  return (
    <FormCard title="Transfer Custody" eyebrow="Current Custodian Action" onSubmit={submit}>
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

  useEffect(() => {
    setForm((current) => ({ ...current, batchId: app.activeBatchId }));
  }, [app.activeBatchId]);

  async function submit(event) {
    event.preventDefault();
    await app.runWalletWrite("Status update", async (contract) => {
      const tx = await contract.updateStatus(form.batchId, Number(form.status), form.notes);
      await tx.wait();
      await app.refreshBatch(form.batchId);
      await app.refreshDashboard();
    });
  }

  return (
    <FormCard title="Update Status" eyebrow="Operational Lifecycle Action" onSubmit={submit}>
      <Field label="Batch ID">
        <input value={form.batchId} onChange={(event) => setForm({ ...form, batchId: event.target.value })} />
      </Field>
      <Field label="New Status">
        <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
          {STATUS_OPTIONS.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Notes">
        <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
      </Field>
      <button type="submit">Submit updateStatus()</button>
    </FormCard>
  );
}

function ConditionsPage({ app }) {
  const [batchId, setBatchId] = useState(app.activeBatchId);
  const [scenario, setScenario] = useState("normal");
  const [file, setFile] = useState(null);
  const [logResult, setLogResult] = useState(null);

  useEffect(() => setBatchId(app.activeBatchId), [app.activeBatchId]);

  async function simulate() {
    try {
      const result = await app.callBackend("/api/logs/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId, scenario })
      });
      setLogResult(result);
      app.setNotice({ type: result.breachFlag ? "warning" : "success", message: result.summary });
    } catch (error) {
      app.setNotice({ type: "error", message: parseError(error) });
    }
  }

  async function upload() {
    if (!file) {
      app.setNotice({ type: "error", message: "Choose a JSON or CSV IoT log first." });
      return;
    }

    try {
      const formData = new FormData();
      formData.append("batchId", batchId);
      formData.append("file", file);

      const result = await app.callBackend("/api/logs/upload", {
        method: "POST",
        body: formData
      });
      setLogResult(result);
      app.setNotice({ type: result.breachFlag ? "warning" : "success", message: result.summary });
    } catch (error) {
      app.setNotice({ type: "error", message: parseError(error) });
    }
  }

  async function anchor() {
    if (!logResult) {
      app.setNotice({ type: "error", message: "Generate or upload a log before anchoring it on-chain." });
      return;
    }

    await app.runWalletWrite("Anchor IoT condition log", async (contract) => {
      const tx = await contract.recordCondition(
        batchId,
        logResult.logHash,
        logResult.logURI,
        logResult.breachFlag,
        logResult.summary
      );
      await tx.wait();
      await app.refreshBatch(batchId);
      await app.refreshDashboard();
    });
  }

  return (
    <section className="page-grid">
      <div className="page-card">
        <p className="eyebrow">Distributor / Retailer Condition Action</p>
        <h2>Upload or Simulate IoT Log</h2>
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
          <button type="button" onClick={simulate}>
            Generate Simulated Log
          </button>
          <label className="file-picker">
            Upload JSON/CSV
            <input type="file" accept=".json,.csv,application/json,text/csv" onChange={(event) => setFile(event.target.files[0])} />
          </label>
          <button type="button" className="secondary" onClick={upload}>
            Process Upload
          </button>
        </div>
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
    await app.runWalletWrite("Regulator verification", async (contract) => {
      const tx = await contract.addVerification(
        form.batchId,
        form.verificationType,
        form.result === "true",
        form.remarks
      );
      await tx.wait();
      await app.refreshBatch(form.batchId);
    });
  }

  async function recall() {
    await app.runWalletWrite("Regulator recall", async (contract) => {
      const tx = await contract.recallBatch(form.batchId, recallReason);
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
      <TraceView trace={app.currentTrace} onCopy={app.copyText} />
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

  const registered = trace && !trace.notFound;

  return (
    <section className="page-card wide consumer-page">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Public Read-only Verification</p>
          <h2>Consumer Batch Check</h2>
          <p className="muted">This page reads from the blockchain and does not require MetaMask.</p>
        </div>
        {registered ? <StatusBadge status={trace.batch.status} recalled={trace.batch.recalled} /> : null}
      </div>

      <form className="search-row" onSubmit={verify}>
        <input value={batchId} onChange={(event) => setBatchId(event.target.value)} placeholder="Enter batch ID" />
        <button type="submit">Verify Batch</button>
      </form>

      {registered ? (
        <div className="plain-result">
          <h3>{trace.batch.recalled ? "Do not use: batch recalled" : "Registered batch found"}</h3>
          <p>
            {trace.batch.batchId} is registered on the provenance contract. Current status is{" "}
            <strong>{statusLabels[trace.batch.status]}</strong>, and the custody trail contains{" "}
            <strong>{trace.custody.length}</strong> transfer record(s).
          </p>
          <TraceView trace={trace} onCopy={app.copyText} />
        </div>
      ) : trace?.notFound ? (
        <div className="warning-panel">
          <strong>Unregistered batch</strong>
          <p>This batch ID was not found on the deployed contract.</p>
        </div>
      ) : (
        <p className="muted">Enter a batch ID or scan a QR code from the batch trace page.</p>
      )}
    </section>
  );
}

function TamperCheckPage({ app }) {
  const [filename, setFilename] = useState("");
  const [expectedHash, setExpectedHash] = useState("");
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);

  async function verify(event) {
    event.preventDefault();
    const options = { method: "POST" };

    if (file) {
      const formData = new FormData();
      formData.append("expectedHash", expectedHash);
      formData.append("file", file);
      options.body = formData;
    } else {
      options.headers = { "Content-Type": "application/json" };
      options.body = JSON.stringify({ filename, expectedHash });
    }

    try {
      const response = await app.callBackend("/api/logs/verify", options);
      setResult(response);
    } catch (error) {
      app.setNotice({ type: "error", message: parseError(error) });
    }
  }

  return (
    <section className="page-grid">
      <form className="page-card" onSubmit={verify}>
        <p className="eyebrow">Tamper Evidence</p>
        <h2>Verify Off-chain Log Hash</h2>
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
        <button type="submit">Run Hash Verification</button>
      </form>

      <div className="page-card">
        <h2>Verification Result</h2>
        {result ? (
          <div className={result.isMatch ? "match-result" : "mismatch-result"}>
            <strong>{result.isMatch ? "MATCH" : "MISMATCH"}</strong>
            <p>{result.message}</p>
            <code className="breakable">Expected: {result.expectedHash}</code>
            <code className="breakable">Recomputed: {result.recomputedHash}</code>
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
    { role: "Admin", address: "" },
    { role: "Manufacturer", address: "" },
    { role: "Distributor", address: "" },
    { role: "Retailer", address: "" },
    { role: "Regulator", address: "" },
    { role: "Consumer", address: "" }
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
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.message || "Backend request failed");
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

  async function refreshDashboard() {
    if (!readContract) return;

    try {
      const ids = await readContract.getAllBatchIds();
      const traces = await Promise.all(ids.map((id) => loadBatchTrace(readContract, id)));
      setBatches(traces.filter((trace) => trace && !trace.notFound));
      addActivity(`Dashboard loaded ${ids.length} batch record(s).`);
    } catch (error) {
      setNotice({ type: "error", message: parseError(error) });
    }
  }

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

      const signer = await browserProvider.getSigner();
      const address = await signer.getAddress();
      const contract = new ethers.Contract(contractAddress, supplyChainAbi, signer);
      const roles = await detectWalletRoles(contract, address);
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

  async function getLocalActors() {
    if (!ethers.isAddress(contractAddress)) {
      throw new Error("Set a valid contract address first.");
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const signers = await Promise.all([0, 1, 2, 3, 4, 5].map((index) => provider.getSigner(index)));
    const addresses = await Promise.all(signers.map((signer) => signer.getAddress()));
    setStakeholders([
      { role: "Admin", address: addresses[0] },
      { role: "Manufacturer", address: addresses[1] },
      { role: "Distributor", address: addresses[2] },
      { role: "Retailer", address: addresses[3] },
      { role: "Regulator", address: addresses[4] },
      { role: "Consumer", address: addresses[5] }
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
      const actors = await getLocalActors();
      await actors.provider.getBlockNumber();
      setNetworkStatus("Local Hardhat");
      setNotice({ type: "success", message: "Connected to local Hardhat RPC." });
      addActivity(`Connected to local RPC at ${rpcUrl}.`);
    } catch (error) {
      setNotice({ type: "error", message: parseError(error) });
    }
  }

  async function grantDemoRoles() {
    try {
      const actors = await getLocalActors();
      const contract = contractFor(actors.admin);
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
      await action(signerContract);
      setNotice({ type: "success", message: `${label} completed.` });
      addActivity(`${label} completed from connected wallet.`);
    } catch (error) {
      setNotice({ type: "error", message: parseError(error) });
    }
  }

  const app = {
    rpcUrl,
    setRpcUrl,
    backendUrl,
    setBackendUrl,
    contractAddress,
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
