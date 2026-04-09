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
  const [logLines, setLogLines] = useState([]);
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [visibleAddresses, setVisibleAddresses] = useState({});

  useEffect(() => {
    loadSavedContractAddress().then((address) => {
      if (address) {
        setContractAddress(address);
      }
    });
  }, []);

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

  return (
    <div className="page-shell">
      <header className="hero">
        <p className="eyebrow">Interim Demo UI</p>
        <h1>Cold Chain Provenance Browser Demo</h1>
        <p className="hero-copy">
          This page is a lightweight local demo for the interim presentation. It talks to a local Hardhat node
          and the deployed <code>SupplyChainProvenance</code> contract.
        </p>
      </header>

      <main className="operations-board">
        <section className="board-top">
          <section className="panel panel-operations card">
            <h2>1. Operations</h2>
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
            <label>
              Batch ID
              <input value={batchId} onChange={(event) => setBatchId(event.target.value)} />
            </label>
            <button onClick={connectToLocalNode} disabled={isBusy}>
              Connect to Local Node
            </button>
            <div className="account-list">
              <strong>Detected Accounts</strong>
              <p className="helper-copy">
                These are local Hardhat test accounts. Account 0 acts as admin, then Accounts 1 to 4 are used as
                manufacturer, distributor, retailer, and regulator for the demo.
              </p>
              {accounts.length === 0 ? <p>No accounts loaded yet.</p> : null}
              {accounts.map((account, index) => (
                <div key={account} className="account-row">
                  <span>{accountLabels[index] ? `Account ${index} (${accountLabels[index]})` : `Account ${index}`}</span>
                  <div className="account-actions">
                    <code>{shortAddress(account)}</code>
                    <button
                      type="button"
                      className="secondary-button inline-button"
                      onClick={() => copyAddress(account, accountLabels[index] || `Account ${index}`)}
                    >
                      Copy
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="button-stack">
              <button onClick={grantRoles} disabled={isBusy || accounts.length < 5}>
                Grant Demo Roles
              </button>
              <button onClick={registerBatch} disabled={isBusy || accounts.length < 5}>
                Register Batch as Manufacturer
              </button>
              <button onClick={moveToDistributor} disabled={isBusy || accounts.length < 5}>
                Transfer to Distributor + Anchor Condition
              </button>
              <button onClick={completeDelivery} disabled={isBusy || accounts.length < 5}>
                Deliver to Retailer + Regulator Verify
              </button>
              <button onClick={refreshBatchDetails} disabled={isBusy || accounts.length < 1}>
                Refresh Batch Details
              </button>
            </div>
            {errorMessage ? <p className="error-box">{errorMessage}</p> : null}
          </section>

          <section className="panel panel-results card">
            <h2>2. Results</h2>
            <section className="panel-subsection">
              <h3>Batch Summary</h3>
              {!batch ? (
                <p>Load a batch after running at least the register step.</p>
              ) : (
                <div className="summary-grid">
                  <div>
                    <span className="label">Batch ID</span>
                    <strong>{batch.batchId}</strong>
                  </div>
                  <div>
                    <span className="label">Product</span>
                    <strong>{batch.productName}</strong>
                  </div>
                  <div>
                    <span className="label">Origin</span>
                    <strong>{batch.origin}</strong>
                  </div>
                  <div>
                    <span className="label">Status</span>
                    <strong>{statusLabels[Number(batch.status)]}</strong>
                  </div>
                  <div>
                    <span className="label">Manufacturer</span>
                    <strong>{shortAddress(batch.manufacturer)}</strong>
                  </div>
                  <div>
                    <span className="label">Current Custodian</span>
                    <strong>{shortAddress(batch.currentCustodian)}</strong>
                  </div>
                </div>
              )}
            </section>
            <section className="panel-subsection log-box">
              <strong>Recent Actions</strong>
              {logLines.length === 0 ? <p>No actions yet.</p> : null}
              {logLines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </section>
          </section>
        </section>

        <section className="panel panel-provenance card">
          <h2>3. Provenance Timeline</h2>
          <div className="timeline-columns">
            <div>
              <h3>Custody</h3>
              {custodyHistory.length === 0 ? <p>No custody history yet.</p> : null}
              {custodyHistory.map((entry, index) => (
                <div key={`${entry.timestamp}-${index}`} className="timeline-item">
                  <strong>{findAccountLabel(entry.from, accounts)} to {findAccountLabel(entry.to, accounts)}</strong>
                  <p className="actor-copy">
                    {shortAddress(entry.from)} to {shortAddress(entry.to)}
                  </p>
                  <p>{entry.location}</p>
                  <p>{entry.notes}</p>
                  {renderAddressToggle(`custody-${entry.timestamp}-${index}`, [
                    { label: "From", value: entry.from },
                    { label: "To", value: entry.to }
                  ])}
                  <p>{formatTimestamp(entry.timestamp)}</p>
                </div>
              ))}
            </div>
            <div>
              <h3>Conditions</h3>
              {conditionHistory.length === 0 ? <p>No condition records yet.</p> : null}
              {conditionHistory.map((entry, index) => (
                <div key={`${entry.timestamp}-${index}`} className="timeline-item">
                  <strong>{entry.breachFlag ? "Breach" : "Normal Log"}</strong>
                  <p>{entry.summary}</p>
                  <p>{entry.logURI}</p>
                  <p className="actor-copy">
                    Submitted by: {findAccountLabel(entry.submittedBy, accounts)} ({shortAddress(entry.submittedBy)})
                  </p>
                  {renderAddressToggle(`condition-${entry.timestamp}-${index}`, [
                    { label: "Submitted by", value: entry.submittedBy }
                  ])}
                  <p>{formatTimestamp(entry.timestamp)}</p>
                </div>
              ))}
            </div>
            <div>
              <h3>Verification</h3>
              {verificationHistory.length === 0 ? <p>No regulator verification yet.</p> : null}
              {verificationHistory.map((entry, index) => (
                <div key={`${entry.timestamp}-${index}`} className="timeline-item">
                  <strong>{entry.verificationType}</strong>
                  <p>{entry.result ? "Passed" : "Failed"}</p>
                  <p>{entry.remarks}</p>
                  <p className="actor-copy">
                    Verified by: {findAccountLabel(entry.verifiedBy, accounts)} ({shortAddress(entry.verifiedBy)})
                  </p>
                  {renderAddressToggle(`verification-${entry.timestamp}-${index}`, [
                    { label: "Verified by", value: entry.verifiedBy }
                  ])}
                  <p>{formatTimestamp(entry.timestamp)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
