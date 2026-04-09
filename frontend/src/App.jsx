import { useEffect, useState } from "react";
import { Contract, JsonRpcProvider, keccak256, toUtf8Bytes } from "ethers";
import { supplyChainAbi, statusLabels } from "./contractAbi";
import "./styles.css";

const defaultBatchId = "BATCHUI001";
const defaultRpcUrl = "http://127.0.0.1:8545";
const accountLabels = {
  0: "Admin",
  1: "Manufacturer",
  2: "Distributor",
  3: "Retailer",
  4: "Regulator"
};
const viewTabs = [
  { id: "demo", label: "Demo" },
  { id: "tracking", label: "Batch Tracking" },
  { id: "history", label: "History" }
];

function shortAddress(value) {
  if (!value) return "-";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function findAccountLabel(address, accounts) {
  const matchIndex = accounts.findIndex((account) => account.toLowerCase() === address.toLowerCase());
  if (matchIndex === -1) return shortAddress(address);
  return accountLabels[matchIndex] || `Account ${matchIndex}`;
}

function formatTimestamp(value) {
  if (!value) return "-";
  return new Date(Number(value) * 1000).toLocaleString();
}

async function loadSavedContractAddress() {
  try {
    const response = await fetch("/demo-contract.json");
    if (!response.ok) return "";
    const data = await response.json();
    return data.contractAddress || "";
  } catch {
    return "";
  }
}

export default function App() {
  const [rpcUrl, setRpcUrl] = useState(defaultRpcUrl);
  const [contractAddress, setContractAddress] = useState("");
  const [batchId, setBatchId] = useState(defaultBatchId);
  const [provider, setProvider] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [batch, setBatch] = useState(null);
  const [custodyHistory, setCustodyHistory] = useState([]);
  const [conditionHistory, setConditionHistory] = useState([]);
  const [verificationHistory, setVerificationHistory] = useState([]);
  const [ledgerHistory, setLedgerHistory] = useState([]);
  const [logLines, setLogLines] = useState([]);
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [visibleAddresses, setVisibleAddresses] = useState({});
  const [activeTab, setActiveTab] = useState("demo");
  const primaryAccounts = accounts.slice(0, 5);
  const extraAccounts = accounts.slice(5);

  useEffect(() => {
    loadSavedContractAddress().then((address) => {
      if (address) {
        setContractAddress(address);
      }
    });
  }, []);

  useEffect(() => {
    if (activeTab === "history" && provider && contractAddress) {
      loadLedgerHistory({ logReload: false });
    }
  }, [activeTab, provider, contractAddress]);

  function pushLog(message) {
    setLogLines((current) => [`${new Date().toLocaleTimeString()} - ${message}`, ...current].slice(0, 10));
  }

  function toggleAddress(key) {
    setVisibleAddresses((current) => ({
      ...current,
      [key]: !current[key]
    }));
  }

  async function copyAddress(address, label) {
    try {
      await navigator.clipboard.writeText(address);
      pushLog(`Copied ${label} address.`);
    } catch (error) {
      setErrorMessage(error.message || "Could not copy the address.");
    }
  }

  function renderAddressToggle(key, rows) {
    const isVisible = Boolean(visibleAddresses[key]);

    return (
      <div className="address-toggle-block">
        <button
          type="button"
          className="secondary-button inline-button"
          onClick={() => toggleAddress(key)}
        >
          {isVisible ? "Hide Address" : "Show Address"}
        </button>
        {isVisible ? (
          <div className="address-details">
            {rows.map(({ label, value }) => (
              <div key={`${key}-${label}`} className="address-detail-row">
                <span>{label}</span>
                <code>{value}</code>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  async function connectToLocalNode() {
    setErrorMessage("");
    try {
      const nextProvider = new JsonRpcProvider(rpcUrl);
      const signerList = await nextProvider.send("eth_accounts", []);
      setProvider(nextProvider);
      setAccounts(signerList);
      pushLog(`Connected to local RPC at ${rpcUrl}`);
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  async function getContractWithSigner(index = 0) {
    if (!provider) throw new Error("Connect to the local RPC first.");
    if (!contractAddress) throw new Error("Enter or deploy a contract address first.");
    const signer = await provider.getSigner(index);
    return new Contract(contractAddress, supplyChainAbi, signer);
  }

  async function grantRoles() {
    setIsBusy(true);
    setErrorMessage("");

    try {
      const contract = await getContractWithSigner(0);
      const manufacturerRole = await contract.MANUFACTURER_ROLE();
      const distributorRole = await contract.DISTRIBUTOR_ROLE();
      const retailerRole = await contract.RETAILER_ROLE();
      const regulatorRole = await contract.REGULATOR_ROLE();

      await (await contract.grantRole(manufacturerRole, accounts[1])).wait();
      await (await contract.grantRole(distributorRole, accounts[2])).wait();
      await (await contract.grantRole(retailerRole, accounts[3])).wait();
      await (await contract.grantRole(regulatorRole, accounts[4])).wait();

      pushLog("Admin granted the stakeholder roles to the local demo accounts.");
    } catch (error) {
      setErrorMessage(error.shortMessage || error.message);
    } finally {
      setIsBusy(false);
    }
  }

  async function registerBatch() {
    setIsBusy(true);
    setErrorMessage("");

    try {
      const contract = await getContractWithSigner(1);
      await (
        await contract.registerBatch(batchId, "Course Demo Vaccine Batch", "Phoenix, AZ", 1711929600)
      ).wait();
      pushLog(`Manufacturer registered ${batchId}.`);
      await refreshBatchDetails({ logReload: false });
    } catch (error) {
      setErrorMessage(error.shortMessage || error.message);
    } finally {
      setIsBusy(false);
    }
  }

  async function moveToDistributor() {
    setIsBusy(true);
    setErrorMessage("");

    try {
      const manufacturerContract = await getContractWithSigner(1);
      const distributorContract = await getContractWithSigner(2);
      const distributorAddress = accounts[2];

      await (
        await manufacturerContract.transferCustody(batchId, distributorAddress, "Phoenix, AZ", "Released to distributor")
      ).wait();
      await (
        await distributorContract.updateStatus(batchId, 1, "Shipment is now in transit")
      ).wait();
      await (
        await distributorContract.recordCondition(
          batchId,
          keccak256(toUtf8Bytes(`${batchId}-normal-ui-log`)),
          `backend/uploads/${batchId}-normal.json`,
          false,
          "12 readings, max temp 6.7C, all readings stayed in the safe range"
        )
      ).wait();

      pushLog("Distributor received custody, marked shipment, and anchored condition log.");
      await refreshBatchDetails({ logReload: false });
    } catch (error) {
      setErrorMessage(error.shortMessage || error.message);
    } finally {
      setIsBusy(false);
    }
  }

  async function completeDelivery() {
    setIsBusy(true);
    setErrorMessage("");

    try {
      const distributorContract = await getContractWithSigner(2);
      const retailerContract = await getContractWithSigner(3);
      const regulatorContract = await getContractWithSigner(4);

      await (
        await distributorContract.transferCustody(batchId, accounts[3], "Tempe, AZ", "Delivered to retailer")
      ).wait();
      await (
        await retailerContract.updateStatus(batchId, 4, "Batch delivered to retailer")
      ).wait();
      await (
        await regulatorContract.addVerification(
          batchId,
          "Temperature Compliance",
          true,
          "Cold chain log reviewed and accepted"
        )
      ).wait();

      pushLog("Retailer completed delivery and regulator added verification.");
      await refreshBatchDetails({ logReload: false });
    } catch (error) {
      setErrorMessage(error.shortMessage || error.message);
    } finally {
      setIsBusy(false);
    }
  }

  async function refreshBatchDetails(options = {}) {
    const { logReload = true } = options;
    setIsBusy(true);
    setErrorMessage("");

    try {
      const contract = await getContractWithSigner(0);
      const [nextBatch, nextCustody, nextConditions, nextVerification] = await Promise.all([
        contract.getBatch(batchId),
        contract.getCustodyHistory(batchId),
        contract.getConditionHistory(batchId),
        contract.getVerificationHistory(batchId)
      ]);

      setBatch(nextBatch);
      setCustodyHistory(nextCustody);
      setConditionHistory(nextConditions);
      setVerificationHistory(nextVerification);
      if (logReload) {
        pushLog(`Loaded current details for ${batchId}.`);
      }
    } catch (error) {
      setErrorMessage(error.shortMessage || error.message);
      setBatch(null);
      setCustodyHistory([]);
      setConditionHistory([]);
      setVerificationHistory([]);
    } finally {
      setIsBusy(false);
    }
  }

  async function loadLedgerHistory(options = {}) {
    const { logReload = true } = options;
    setIsBusy(true);
    setErrorMessage("");

    try {
      const contract = await getContractWithSigner(0);
      const batchIds = await contract.getAllBatchIds();
      const nextLedgerHistory = await Promise.all(
        batchIds.map(async (nextBatchId) => {
          const [nextBatch, nextCustody, nextConditions, nextVerification] = await Promise.all([
            contract.getBatch(nextBatchId),
            contract.getCustodyHistory(nextBatchId),
            contract.getConditionHistory(nextBatchId),
            contract.getVerificationHistory(nextBatchId)
          ]);

          return {
            batch: nextBatch,
            custodyHistory: nextCustody,
            conditionHistory: nextConditions,
            verificationHistory: nextVerification
          };
        })
      );

      setLedgerHistory(nextLedgerHistory);
      if (logReload) {
        pushLog(`Loaded ledger history for ${nextLedgerHistory.length} batches.`);
      }
    } catch (error) {
      setErrorMessage(error.shortMessage || error.message);
      setLedgerHistory([]);
    } finally {
      setIsBusy(false);
    }
  }

  function renderBatchSummary(targetBatch) {
    if (!targetBatch) {
      return <p>Load a batch after running at least the register step.</p>;
    }

    return (
      <div className="summary-grid">
        <div>
          <span className="label">Batch ID</span>
          <strong>{targetBatch.batchId}</strong>
        </div>
        <div>
          <span className="label">Product</span>
          <strong>{targetBatch.productName}</strong>
        </div>
        <div>
          <span className="label">Origin</span>
          <strong>{targetBatch.origin}</strong>
        </div>
        <div>
          <span className="label">Status</span>
          <strong>{statusLabels[Number(targetBatch.status)]}</strong>
        </div>
        <div>
          <span className="label">Manufacturer</span>
          <strong>{shortAddress(targetBatch.manufacturer)}</strong>
        </div>
        <div>
          <span className="label">Current Custodian</span>
          <strong>{shortAddress(targetBatch.currentCustodian)}</strong>
        </div>
      </div>
    );
  }

  function renderTimelineColumns(prefix, nextCustodyHistory, nextConditionHistory, nextVerificationHistory, compact = false) {
    return (
      <div className={`timeline-columns${compact ? " timeline-columns-compact" : ""}`}>
        <section className="timeline-lane">
          <div className="timeline-lane-header">
            <h3>Custody</h3>
            <p>Transfer history across custodians.</p>
          </div>
          {nextCustodyHistory.length === 0 ? <p className="timeline-empty">No custody history yet.</p> : null}
          <ol className="timeline-track">
            {nextCustodyHistory.map((entry, index) => (
              <li key={`${prefix}-custody-${entry.timestamp}-${index}`} className="timeline-item">
                <div className="timeline-item-header">
                  <strong>{findAccountLabel(entry.from, accounts)} to {findAccountLabel(entry.to, accounts)}</strong>
                  <span>{formatTimestamp(entry.timestamp)}</span>
                </div>
                <p className="timeline-detail">
                  {shortAddress(entry.from)} to {shortAddress(entry.to)}
                </p>
                <p className="timeline-detail">{entry.location}</p>
                <p className="timeline-detail">{entry.notes}</p>
                {renderAddressToggle(`${prefix}-custody-${entry.timestamp}-${index}`, [
                  { label: "From", value: entry.from },
                  { label: "To", value: entry.to }
                ])}
              </li>
            ))}
          </ol>
        </section>
        <section className="timeline-lane">
          <div className="timeline-lane-header">
            <h3>Conditions</h3>
            <p>Temperature and sensor logs submitted along the route.</p>
          </div>
          {nextConditionHistory.length === 0 ? <p className="timeline-empty">No condition records yet.</p> : null}
          <ol className="timeline-track">
            {nextConditionHistory.map((entry, index) => (
              <li key={`${prefix}-condition-${entry.timestamp}-${index}`} className="timeline-item">
                <div className="timeline-item-header">
                  <strong>{entry.breachFlag ? "Breach" : "Normal Log"}</strong>
                  <span>{formatTimestamp(entry.timestamp)}</span>
                </div>
                <p className="timeline-detail">{entry.summary}</p>
                <p className="timeline-detail">{entry.logURI}</p>
                <p className="actor-copy timeline-detail">
                  Submitted by: {findAccountLabel(entry.submittedBy, accounts)} ({shortAddress(entry.submittedBy)})
                </p>
                {renderAddressToggle(`${prefix}-condition-${entry.timestamp}-${index}`, [
                  { label: "Submitted by", value: entry.submittedBy }
                ])}
              </li>
            ))}
          </ol>
        </section>
        <section className="timeline-lane">
          <div className="timeline-lane-header">
            <h3>Verification</h3>
            <p>Regulator checks that confirm shipment status.</p>
          </div>
          {nextVerificationHistory.length === 0 ? <p className="timeline-empty">No regulator verification yet.</p> : null}
          <ol className="timeline-track">
            {nextVerificationHistory.map((entry, index) => (
              <li key={`${prefix}-verification-${entry.timestamp}-${index}`} className="timeline-item">
                <div className="timeline-item-header">
                  <strong>{entry.verificationType}</strong>
                  <span>{formatTimestamp(entry.timestamp)}</span>
                </div>
                <p className="timeline-detail">{entry.result ? "Passed" : "Failed"}</p>
                <p className="timeline-detail">{entry.remarks}</p>
                <p className="actor-copy timeline-detail">
                  Verified by: {findAccountLabel(entry.verifiedBy, accounts)} ({shortAddress(entry.verifiedBy)})
                </p>
                {renderAddressToggle(`${prefix}-verification-${entry.timestamp}-${index}`, [
                  { label: "Verified by", value: entry.verifiedBy }
                ])}
              </li>
            ))}
          </ol>
        </section>
      </div>
    );
  }

  function renderControlSidebar() {
    return (
      <aside className="panel panel-operations app-sidebar" aria-label="Control sidebar">
        <h2>Control Center</h2>
        <p className="support-copy">
          Manage the active batch workflow from this rail after connecting the local network from the header.
        </p>
        {errorMessage ? <p className="error-box">{errorMessage}</p> : null}
        <section className="panel-subsection panel-subsection-compact rail-settings">
          <label>
            Batch ID
            <input value={batchId} onChange={(event) => setBatchId(event.target.value)} />
          </label>
          <button
            type="button"
            className="register-batch-button"
            onClick={registerBatch}
            disabled={isBusy || accounts.length < 5}
          >
            Register Batch (Manufacturer)
          </button>
          <button type="button" onClick={moveToDistributor} disabled={isBusy || accounts.length < 5}>
            Send to Distributor (Manufacturer -&gt; Distributor)
          </button>
          <button type="button" onClick={completeDelivery} disabled={isBusy || accounts.length < 5}>
            Deliver &amp; Verify (Retailer + Regulator)
          </button>
          <button type="button" onClick={refreshBatchDetails} disabled={isBusy || accounts.length < 1}>
            Refresh Batch Details
          </button>
          <details className="connection-details">
            <summary>Edit connection details</summary>
            <div className="connection-form">
              <label>
                Local RPC URL
                <input value={rpcUrl} onChange={(event) => setRpcUrl(event.target.value)} />
              </label>
              <label>
                Contract Address
                <input
                  value={contractAddress}
                  onChange={(event) => setContractAddress(event.target.value)}
                  placeholder="Run npm.cmd run deploy:local first"
                />
              </label>
            </div>
          </details>
        </section>
        <div className="account-list">
          <strong>Stakeholder Wallets</strong>
          <p className="helper-copy">
            Account 0 manages the network roles. Accounts 1 to 4 represent manufacturer, distributor,
            retailer, and regulator operators in this workspace.
          </p>
          {accounts.length === 0 ? <p>No accounts loaded yet.</p> : null}
          {primaryAccounts.length > 0 ? (
            <div className="stakeholder-group">
              {primaryAccounts.map((account, index) => (
                <div key={account} className="stakeholder-row">
                  <div className="stakeholder-copy">
                    <span className="stakeholder-label">
                      <span className="account-index-pill">Account {index}</span>
                      <span>{accountLabels[index] || `Account ${index}`}</span>
                    </span>
                    <code>{shortAddress(account)}</code>
                  </div>
                  <button
                    type="button"
                    className="secondary-button inline-button"
                    onClick={() => copyAddress(account, accountLabels[index] || `Account ${index}`)}
                  >
                    Copy
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          {extraAccounts.length > 0 ? (
            <details className="extra-accounts">
              <summary>Show extra local test accounts</summary>
              <div className="extra-accounts-body">
                {extraAccounts.map((account, offset) => {
                  const index = offset + 5;

                  return (
                    <div key={account} className="account-row">
                      <div className="stakeholder-copy">
                        <span className="stakeholder-label">
                          <span className="account-index-pill">Account {index}</span>
                        </span>
                        <code>{shortAddress(account)}</code>
                      </div>
                      <button
                        type="button"
                        className="secondary-button inline-button"
                        onClick={() => copyAddress(account, `Account ${index}`)}
                      >
                        Copy
                      </button>
                    </div>
                  );
                })}
              </div>
            </details>
          ) : null}
        </div>
      </aside>
    );
  }

  return (
    <div className="page-shell">
      <div className="app-layout">
        {renderControlSidebar()}

        <section className="app-content" aria-label="App content">
          <header className="hero">
            <div className="hero-copy-block">
              <p className="eyebrow">Pharmaceutical Cold Chain</p>
              <h1>ColdChain Provenance</h1>
              <p className="hero-copy">
                Track custody, temperature integrity, and compliance review for regulated pharmaceutical shipments
                from release through final delivery.
              </p>
            </div>
            <div className="hero-actions" aria-label="Header actions">
              <button onClick={connectToLocalNode} disabled={isBusy}>
                Connect Network (Admin)
              </button>
              <button onClick={grantRoles} disabled={isBusy || accounts.length < 5}>
                Grant Demo Roles (Admin)
              </button>
            </div>
          </header>

          <nav className="view-nav" role="tablist" aria-label="Primary views">
            {viewTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                id={`tab-${tab.id}`}
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`panel-${tab.id}`}
                className={`view-tab${activeTab === tab.id ? " is-active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {activeTab === "demo" ? (
            <main className="operations-board view-panel" id="panel-demo" role="tabpanel" aria-labelledby="tab-demo">
              <section className="panel panel-results">
                <h2>Shipment Overview</h2>
                <section className="panel-subsection">
                  <div className="section-heading-inline">
                    <h3>Current Batch</h3>
                    <div className="inline-status-card">
                      <span className="status-label">Active Batch</span>
                      <strong>{batchId}</strong>
                    </div>
                  </div>
                  {renderBatchSummary(batch)}
                </section>
                <section className="panel-subsection log-box">
                  <strong>Activity Feed</strong>
                  {logLines.length === 0 ? <p>No actions yet.</p> : null}
                  {logLines.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </section>
              </section>

              <section className="panel panel-provenance">
                <h2>Provenance Timeline</h2>
                {renderTimelineColumns(`demo-${batchId}`, custodyHistory, conditionHistory, verificationHistory)}
              </section>
            </main>
          ) : null}

          {activeTab === "tracking" ? (
            <main className="operations-board view-panel" id="panel-tracking" role="tabpanel" aria-labelledby="tab-tracking">
              <section className="panel tracking-toolbar-panel">
                <div className="panel-header">
                  <div>
                    <h2>Batch Tracking</h2>
                    <p className="panel-copy">Inspect the active batch, refresh its state, and review its current provenance trail.</p>
                  </div>
                  <button onClick={refreshBatchDetails} disabled={isBusy || accounts.length < 1}>
                    Refresh Batch Details
                  </button>
                </div>
                {errorMessage ? <p className="error-box">{errorMessage}</p> : null}
                <label className="tracking-batch-field">
                  Batch ID
                  <input value={batchId} onChange={(event) => setBatchId(event.target.value)} />
                </label>
              </section>

              <section className="board-top">
                <section className="panel panel-results">
                  <h2>Current Batch</h2>
                  <section className="panel-subsection">
                    {renderBatchSummary(batch)}
                  </section>
                </section>
                <section className="panel panel-results">
                  <h2>Activity Feed</h2>
                  <section className="panel-subsection log-box">
                    {logLines.length === 0 ? <p>No actions yet.</p> : null}
                    {logLines.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </section>
                </section>
              </section>

              <section className="panel panel-provenance">
                <h2>Current Batch Timeline</h2>
                {renderTimelineColumns(`tracking-${batchId}`, custodyHistory, conditionHistory, verificationHistory)}
              </section>
            </main>
          ) : null}

          {activeTab === "history" ? (
            <main className="operations-board view-panel" id="panel-history" role="tabpanel" aria-labelledby="tab-history">
              <section className="panel panel-history">
                <div className="panel-header">
                  <div>
                    <h2>Ledger History</h2>
                    <p className="panel-copy">Review every registered batch and its full blockchain provenance trail.</p>
                  </div>
                  <button onClick={() => loadLedgerHistory()} disabled={isBusy || !provider || !contractAddress}>
                    Refresh Full History
                  </button>
                </div>
                {errorMessage ? <p className="error-box">{errorMessage}</p> : null}
                {!provider ? <p>Connect the network from the Demo tab to load ledger history.</p> : null}
                {provider && !contractAddress ? <p>Load the contract address to inspect ledger history.</p> : null}
                {provider && contractAddress && ledgerHistory.length === 0 && !isBusy ? (
                  <p>No batches have been registered on-chain yet.</p>
                ) : null}
                <div className="ledger-list">
                  {ledgerHistory.map((entry) => (
                    <article key={entry.batch.batchId} className="ledger-card">
                      <div className="ledger-header">
                        <div>
                          <h3>{entry.batch.batchId}</h3>
                          <p>{entry.batch.productName}</p>
                        </div>
                        <span className="ledger-status">{statusLabels[Number(entry.batch.status)]}</span>
                      </div>
                      {renderBatchSummary(entry.batch)}
                      {renderTimelineColumns(
                        `history-${entry.batch.batchId}`,
                        entry.custodyHistory,
                        entry.conditionHistory,
                        entry.verificationHistory,
                        true
                      )}
                    </article>
                  ))}
                </div>
              </section>
            </main>
          ) : null}
        </section>
      </div>
    </div>
  );
}
