# Blockchain-Based Cold Chain Provenance System for Pharmaceutical Shipments

This project is a blockchain-powered supply chain provenance system for temperature-sensitive pharmaceutical shipments. It tracks a batch from manufacturer registration through distributor custody, IoT condition logging, retailer delivery, regulator verification, and public consumer lookup.

The implementation is intentionally focused on provenance rather than a generic dashboard. The blockchain stores role-controlled lifecycle events, custody history, hashes of off-chain IoT logs, and regulator decisions. Raw sensor files stay off-chain in the backend.

## Stakeholders

- `Admin`: deploys the contract and grants stakeholder roles.
- `Manufacturer`: registers new product batches and starts custody.
- `Distributor`: receives custody, ships products, and anchors IoT condition logs.
- `Retailer`: receives and delivers products.
- `Regulator`: verifies compliance and can recall a batch.
- `Consumer`: read-only public verification through batch lookup or QR route.

## Architecture

```text
React + Vite UI
  - production-style stakeholder wallet access
  - role-specific operating workspaces
  - public consumer verification route
  - QR code batch lookup
  - collapsed local sandbox tools for course demonstration

Express backend
  - simulated IoT data generation
  - JSON/CSV upload
  - local off-chain file storage
  - keccak256 digest computation
  - tamper verification

Hardhat + Solidity
  - SupplyChainProvenance contract
  - OpenZeppelin AccessControl roles
  - custody, condition, verification, and recall history
```

## On-chain vs Off-chain Data

On-chain:

- batch metadata
- current status and custodian
- custody transfer history
- condition log hashes and URIs
- regulator verification records
- recall records

Off-chain:

- raw IoT JSON/CSV logs
- generated simulated sensor readings
- uploaded files used for tamper checks

This keeps the contract auditable without putting large raw telemetry files on-chain. The backend computes a `keccak256` digest, and the contract stores that digest as the proof. Later, the app can recompute the file hash and show `MATCH` or `MISMATCH`.

## Contract Features

Main contract: `contracts/SupplyChainProvenance.sol`

Status model:

- `Created`
- `Shipped`
- `Received`
- `Stored`
- `Delivered`
- `Flagged`
- `Recalled`

Core functions:

- `registerBatch`
- `transferCustody`
- `updateStatus`
- `recordCondition`
- `addVerification`
- `recallBatch`
- read functions for batch, custody, condition, verification, recall, and all batch IDs

Access control is enforced in the smart contract. Unauthorized actions are rejected even if someone tries to call the contract outside the UI.

## Production-Style Access Model

The application is designed as a stakeholder portal. In a real deployment, each organization opens the same hosted web app but connects its own MetaMask wallet:

- manufacturer wallet for registering batches
- distributor wallet for shipment custody and condition log anchoring
- retailer wallet for receiving and delivery updates
- regulator wallet for compliance verification and recall actions
- public consumer access without a wallet for read-only verification

The computer or physical location does not determine access. The connected wallet address determines access, and the smart contract checks whether that address has the required role.

For local development, Hardhat accounts simulate those different stakeholder wallets. The UI keeps those shortcuts under `Developer sandbox` so the main product experience remains production-facing.

## Grant or Remove Stakeholder Access

Open `Admin Access` in the app to manage stakeholder wallets from the frontend:

1. Connect the admin MetaMask wallet.
2. Paste the stakeholder's public wallet address.
3. Select `Admin`, `Manufacturer`, `Distributor`, `Retailer`, or `Regulator`.
4. Click `Grant Access` to call `grantRole` on the smart contract.
5. Click `Check Role` to confirm the address has the selected role.
6. Click `Remove Access` to call `revokeRole` when a stakeholder should no longer have that role.

Only an address with the contract admin role can grant or revoke access. If any other wallet tries this, the contract rejects the transaction. Do not revoke the last admin wallet, because that would lock role management until the contract is redeployed.

## Local Setup

Install root blockchain dependencies:

```bash
npm install
```

Install backend dependencies:

```bash
cd backend
npm install
```

Install frontend dependencies:

```bash
cd frontend
npm install
```

## Run the Full Local App

Use separate terminals.

Terminal 1: start local blockchain

```bash
npm run node
```

Terminal 2: deploy contract to the local node

```bash
npm run deploy:local
```

This writes the deployed contract address to `frontend/public/demo-contract.json`.

Terminal 3: start backend API

```bash
npm run dev:backend
```

Terminal 4: start frontend

```bash
npm run dev:frontend
```

Open the Vite URL shown by the frontend terminal, usually `http://localhost:5173`.

## Local Sandbox Flow

The production flow should be demonstrated through the role pages and stakeholder wallet access. For a fast local recording, the same actions are available under the collapsed `Developer sandbox` section in the left rail:

1. `Connect Sandbox Network`
2. `Assign Sandbox Roles`
3. `Run Manufacturer Step`
4. `Run Distributor Step`
5. `Run Retailer + Regulator Step`
6. Open `Batch Trace` to view the complete provenance timeline.
7. Open `Consumer Verify` or scan the QR code from `Batch Trace`.
8. Use `Run Breach + Recall Scenario` to show exception handling.
9. Use `Run Unauthorized Action Check` to show contract-level role rejection.

The local sandbox uses default Hardhat accounts:

- Account 0: Admin
- Account 1: Manufacturer
- Account 2: Distributor
- Account 3: Retailer
- Account 4: Regulator
- Account 5: Consumer sandbox account

## Backend API

Default backend URL: `http://localhost:4000`

Routes:

- `GET /api/health`
- `POST /api/logs/upload`
- `POST /api/logs/simulate`
- `GET /api/logs/:filename`
- `POST /api/logs/verify`
- `GET /api/batches/:batchId/offchain-summary`

Safe temperature range is 2C to 8C. Any reading outside that range sets `breachFlag = true`.

## Public Consumer Verification

The consumer route is read-only and does not require MetaMask:

```text
/verify
/verify/BATCH001
```

It shows whether a batch is registered, its current lifecycle status, custody chain summary, and any warning for flagged or recalled shipments.

## Tests and Validation

Run smart contract tests:

```bash
npm test
```

Run backend tests:

```bash
npm --prefix backend test
```

Run frontend tests:

```bash
npm --prefix frontend test
```

Run frontend production build:

```bash
npm --prefix frontend run build
```

Run gas report:

```bash
npm run gas
```

Run the terminal backup demo:

```bash
npm run demo:flow
```

## Testnet Deployment

Create a root `.env` file from `.env.example` and provide:

```text
AMOY_RPC_URL=
PRIVATE_KEY=
ADMIN_ADDRESS=
```

Then deploy to Polygon Amoy:

```bash
npm run deploy -- --network amoy
```

For the frontend to read the Amoy contract, set these frontend environment values before building or hosting the UI:

```text
VITE_RPC_URL=https://rpc-amoy.polygon.technology/
VITE_CONTRACT_ADDRESS=<deployed Amoy contract address>
VITE_BACKEND_URL=<your backend API URL>
```

Do not commit private keys or real secrets.

## GitHub Pages Hosting

GitHub Pages can host the React frontend as a public static site. It cannot host the Express backend, so public upload/simulation/tamper-check APIs need a separate backend host if those features must work outside your machine.

The repository includes a GitHub Actions workflow at `.github/workflows/deploy-pages.yml`. To use it:

1. Deploy the contract to Polygon Amoy and copy the contract address.
2. In GitHub, open `Settings` -> `Secrets and variables` -> `Actions` -> `Variables`.
3. Add these repository variables:

```text
VITE_RPC_URL=https://rpc-amoy.polygon.technology/
VITE_CONTRACT_ADDRESS=<deployed Amoy contract address>
VITE_BACKEND_URL=<hosted backend URL, or leave blank for blockchain-only public demo>
```

4. Open `Settings` -> `Pages` and set the source to `GitHub Actions`.
5. Push to `main`, or manually run the `Deploy Frontend to GitHub Pages` workflow.

The hosted URL will be:

```text
https://mganesh1610.github.io/Group-13-Blockchain-Based-Pharmaceutical-Shipments/
```

Because the app is a single-page React app, the workflow also publishes a `404.html` fallback so shared batch/QR links such as `/verify/BATCH001` can load through GitHub Pages.

## Why Blockchain Helps Here

A centralized tracker can be edited by whichever party controls the database. This project uses smart-contract events and role-based transactions so each stakeholder action is attributable, ordered, and harder to alter after the fact. The design also avoids putting sensitive raw telemetry on-chain by anchoring hashes and keeping raw files off-chain.

Limitations:

- Blockchain proves that a log hash was anchored, not that a physical sensor was honest.
- Public chains can leak metadata if sensitive identifiers are stored directly.
- Production use would need stronger identity management, oracle/sensor trust controls, privacy review, and integration with logistics or ERP systems.
