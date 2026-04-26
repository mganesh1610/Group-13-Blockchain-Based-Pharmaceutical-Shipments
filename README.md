# Blockchain-Based Cold Chain Provenance System for Pharmaceutical Shipments

## Project Description

This project is a blockchain-powered supply chain provenance system for temperature-sensitive pharmaceutical shipments. It tracks a product batch from manufacturer registration through distributor shipment, IoT condition logging, retailer delivery, regulator verification, recall handling, and public consumer verification.

The goal is to show why blockchain is useful for multi-party supply chain traceability. The smart contract records role-controlled lifecycle events, custody transfers, condition log hashes, regulator decisions, and recall actions. Raw IoT logs are stored off-chain and verified by comparing their `keccak256` hash with the digest anchored on-chain.

Live deployment:

- Public GitHub repository: [https://github.com/mganesh1610/Group-13-Blockchain-Based-Pharmaceutical-Shipments](https://github.com/mganesh1610/Group-13-Blockchain-Based-Pharmaceutical-Shipments)
- Web app: [https://coldchain-provenance.vercel.app](https://coldchain-provenance.vercel.app)
- Polygon Amoy contract: `0xAFdcF244CAb9d632946c42A07463F3105B605EF0`
- Amoy explorer: [View contract on PolygonScan](https://amoy.polygonscan.com/address/0xAFdcF244CAb9d632946c42A07463F3105B605EF0)

Recommended grading path:

1. Open the live web app.
2. Add Polygon Amoy Testnet to MetaMask using the network settings below.
3. Import the funded grader wallet provided in the private Canvas submission notes.
4. Connect the wallet in the app and run the role-specific workflow.
5. Use `Batch Trace`, `Consumer Verify`, and `Tamper Check` to inspect the proof trail.

The local setup instructions are included below for source-code verification and repeatable testing.

## Stakeholders and Permissions

- `Admin`: grants and removes stakeholder roles.
- `Manufacturer`: registers pharmaceutical batches and starts custody.
- `Distributor`: receives custody, ships products, and anchors IoT condition logs.
- `Retailer`: receives shipments and marks delivery.
- `Regulator`: verifies compliance and can recall a batch.
- `Consumer`: uses public read-only batch verification without a wallet.

Access is enforced by the Solidity smart contract using OpenZeppelin `AccessControl`. The UI can request a transaction, but unauthorized actions still revert at the contract level.

## Stakeholder Access Management

The `Admin Access` page lets an authorized admin manage stakeholder wallets directly from the web app:

1. Connect an admin MetaMask wallet.
2. Paste the stakeholder public wallet address.
3. Select `Admin`, `Manufacturer`, `Distributor`, `Retailer`, or `Regulator`.
4. Grant the role to enable that wallet's role-specific pages and contract actions.
5. Remove the role when a stakeholder should no longer have that access.

The connected wallet address determines access. The physical computer, browser, or location does not grant permissions by itself.

## System Architecture

```text
React + Vite frontend
  - stakeholder wallet connection through MetaMask
  - admin role management page
  - role-specific menus for admin, manufacturer, distributor, retailer, and regulator
  - batch registration, custody transfer, status, condition, regulator, and trace pages
  - public consumer verification and QR route

Node.js + Express backend
  - simulated IoT log generation
  - JSON/CSV upload
  - temperature breach detection
  - keccak256 hash computation
  - tamper verification
  - Azure Blob Storage for raw IoT files in the live deployment
  - Azure SQL persistence for log metadata and storage references
  - local file fallback for development

Solidity + Hardhat
  - SupplyChainProvenance smart contract
  - Polygon Amoy testnet deployment
  - role-based access control
  - custody, condition, verification, and recall history
```

## On-Chain vs Off-Chain Data

On-chain data:

- Batch metadata
- Current lifecycle status
- Current custodian
- Complete custody transfer history
- IoT log hash and URI
- Regulator verification records
- Recall records

Off-chain data:

- Raw JSON/CSV IoT logs
- Simulated sensor readings
- Uploaded files for tamper checks
- Raw file storage in Azure Blob Storage for the live deployment
- Metadata stored in Azure SQL or local development storage

This split keeps blockchain storage small while still providing tamper evidence. If a raw log changes, the recomputed hash no longer matches the on-chain digest.

## Main Smart Contract

Main contract:

```text
contracts/SupplyChainProvenance.sol
```

Core functions:

- `registerBatch`
- `transferCustody`
- `updateStatus`
- `recordCondition`
- `addVerification`
- `recallBatch`
- `getBatch`
- `getCustodyHistory`
- `getConditionHistory`
- `getVerificationHistory`
- `getRecallInfo`

Lifecycle statuses:

- `Created`
- `Shipped`
- `Received`
- `Stored`
- `Delivered`
- `Flagged`
- `Recalled`

The contract also emits events for batch registration, custody transfers, status updates, condition anchoring, regulator verification, and recall actions. These events provide an auditable sequence of stakeholder activity that complements the stored batch history.

## Course Requirements Covered

- Multi-party lifecycle: manufacturer, distributor, retailer, regulator, and consumer.
- Product journey: creation, shipment, storage/condition logging, delivery, verification, and recall handling.
- Required transactions: registration, custody transfer, status update, condition update, regulator verification, and exception handling.
- Access control: OpenZeppelin `AccessControl` roles with contract-level enforcement and revert behavior.
- Provenance: complete custody history and condition/verification timelines are displayed in the UI.
- Off-chain storage: raw IoT logs stay off-chain while hashes and summaries are anchored on-chain.
- Tamper evidence: uploaded or generated logs can be re-hashed and compared against the on-chain digest.

## Repository Structure

```text
contracts/          Solidity smart contract
scripts/            Hardhat deployment and demo scripts
test/               Smart contract tests
backend/            Express API for IoT logs and off-chain storage
frontend/           React + Vite frontend
api/                Vercel serverless entrypoint for the Express app
vercel.json         Vercel deployment configuration
```

## Dependencies

Required:

- Node.js 20 or later
- npm
- MetaMask browser extension
- Polygon Amoy test `POL` for testnet deployment and write transactions

Blockchain dependencies:

- Solidity `0.8.20`
- Hardhat
- OpenZeppelin Contracts
- Ethers v6
- hardhat-gas-reporter

Backend dependencies:

- Express
- Multer
- CORS
- dotenv
- ethers
- mssql
- @azure/storage-blob

Frontend dependencies:

- React
- Vite
- React Router
- Ethers v6
- qrcode.react

## Local Setup

Install root dependencies:

```bash
npm install
```

Install backend dependencies:

```bash
npm --prefix backend install
```

Install frontend dependencies:

```bash
npm --prefix frontend install
```

## Environment Variables

Root `.env` for deployment:

```text
AMOY_RPC_URL=https://rpc-amoy.polygon.technology/
PRIVATE_KEY=<testnet deployer private key>
ADMIN_ADDRESS=<administrator wallet address>
CONTRACT_ADDRESS=<optional deployed contract address>
```

Backend `.env` for local API, Azure SQL, and Azure Blob Storage:

```text
PORT=4000
CORS_ORIGIN=http://localhost:5173
UPLOAD_DIR=
AZURE_SQL_SERVER=<server>.database.windows.net
AZURE_SQL_DATABASE=<database name>
AZURE_SQL_USER=<sql username>
AZURE_SQL_PASSWORD=<sql password>
AZURE_SQL_PORT=1433
AZURE_SQL_ENCRYPT=true
AZURE_SQL_TRUST_SERVER_CERTIFICATE=false
AZURE_SQL_RETRY_ATTEMPTS=5
AZURE_SQL_RETRY_BASE_DELAY_MS=5000
AZURE_STORAGE_CONNECTION_STRING=<storage account connection string>
AZURE_STORAGE_CONTAINER=iot-logs
```

Frontend `.env` for local frontend overrides:

```text
VITE_RPC_URL=http://127.0.0.1:8545
VITE_BACKEND_URL=http://localhost:4000
VITE_CONTRACT_ADDRESS=
VITE_BASE_PATH=/
```

For local development, `VITE_RPC_URL` and `VITE_CONTRACT_ADDRESS` must match the blockchain network selected in MetaMask. A localhost frontend can still use MetaMask; the browser URL does not decide the blockchain network.

Real `.env` files, private keys, database passwords, and storage connection strings must stay outside GitHub.

## Polygon Amoy Network for MetaMask

Use this network when interacting with the deployed testnet contract:

```text
Network name: Polygon Amoy Testnet
RPC URL: https://rpc-amoy.polygon.technology/
Chain ID: 80002
Currency symbol: POL
Block explorer URL: https://amoy.polygonscan.com/
```

Steps to add Polygon Amoy in MetaMask:

1. Open MetaMask.
2. Click the network selector at the top.
3. Choose `Add a custom network`.
4. Enter the network details above.
5. Save the network.
6. Switch MetaMask to `Polygon Amoy Testnet` before using the deployed app.

Polygon Amoy deployments and stakeholder write transactions require Amoy test `POL` for gas. Local Hardhat testing does not require testnet tokens because Hardhat creates pre-funded local test accounts automatically. Testnet tokens have no real-world value and are only used for gas on Polygon Amoy.

## Run Locally

Use four terminals.

Terminal 1: start local blockchain:

```bash
npm run node
```

Terminal 2: deploy contract locally:

```bash
npm run deploy:local
```

Terminal 3: start backend:

```bash
npm run dev:backend
```

Terminal 4: start frontend:

```bash
npm run dev:frontend
```

Open:

```text
http://localhost:5173
```

## MetaMask with Localhost

Yes, MetaMask can connect while the app is running at `http://localhost:5173`. The important rule is that MetaMask and the frontend contract settings must point to the same blockchain network.

Option A: local Hardhat network

1. Run `npm run node`.
2. Run `npm run deploy:local`.
3. In MetaMask, add a custom network:
   - Network name: `Local Hardhat`
   - RPC URL: `http://127.0.0.1:8545`
   - Chain ID: `31337`
   - Currency symbol: `ETH`
4. Import the Hardhat demo accounts into MetaMask using the private keys printed by the Hardhat node.
5. Use account 0 as admin, then grant roles or use the `Developer sandbox` shortcuts.

Option B: localhost frontend with deployed Polygon Amoy contract

1. Keep the frontend running at `http://localhost:5173`.
2. Set `frontend/.env` to the deployed testnet contract:

```text
VITE_RPC_URL=https://rpc-amoy.polygon.technology/
VITE_BACKEND_URL=http://localhost:4000
VITE_CONTRACT_ADDRESS=0xAFdcF244CAb9d632946c42A07463F3105B605EF0
```

3. Restart the Vite frontend after editing `.env`.
4. Switch MetaMask to `Polygon Amoy`.
5. Connect the stakeholder wallet and use the role-specific pages.

If MetaMask is on Amoy but the app is configured for local Hardhat, or MetaMask is on local Hardhat but the app is configured for Amoy, role detection and write transactions will not work correctly.

## How to Use the App

1. Open the web app.
2. Connect MetaMask using `Connect Stakeholder Wallet`.
3. Make sure MetaMask is on the same network as the configured contract: local Hardhat for local contracts, or Polygon Amoy for the deployed testnet contract.
4. Use `Admin Access` to grant or remove stakeholder roles.
5. Use `Register Batch` as a manufacturer to create a pharmaceutical batch.
6. Use `Transfer Custody` to move the batch to the next stakeholder.
7. Use `Status Update` to record lifecycle progress when needed.
8. Use `Condition Logs` to generate or upload IoT logs and anchor their hash on-chain.
9. Use `Regulator Review` to add verification or recall a batch.
10. Use `Batch Trace` to view the full provenance timeline.
11. Use `Consumer Verify` or the QR route for read-only public verification without requiring a wallet.
12. Use `Tamper Check` to compare an off-chain file with an expected on-chain hash.

The navigation changes based on the connected wallet role. Unassigned wallets only see public/read-only pages. Stakeholder wallets see the pages matching their assigned roles.

## Grader Live Testing

The live deployment is available at:

```text
https://coldchain-provenance.vercel.app
```

The deployed Polygon Amoy contract is:

```text
0xAFdcF244CAb9d632946c42A07463F3105B605EF0
```

For grading, a funded Polygon Amoy test wallet is provided separately through the Canvas submission notes. The wallet is intended only for live testnet evaluation.

To use the grader wallet:

1. Open MetaMask.
2. Add the `Polygon Amoy Testnet` network using the details in the section above.
3. Import the grader wallet using the credential provided in Canvas.
4. Switch MetaMask to `Polygon Amoy Testnet`.
5. Open [https://coldchain-provenance.vercel.app](https://coldchain-provenance.vercel.app).
6. Click `Connect Stakeholder Wallet`.
7. Use the role-specific menu shown after connection.

Recommended roles for a single grader test wallet:

- `Admin`
- `Manufacturer`
- `Distributor`
- `Retailer`
- `Regulator`

Granting all five roles to a single test wallet makes it possible to evaluate the full workflow from one MetaMask account. In a real deployment, each organization would use a separate wallet with only its own role. If the grader wallet shows `Unassigned wallet`, an admin wallet can use `Admin Access` to grant the needed roles.

## Local Sandbox Demo

For quick local demonstrations, the left sidebar includes a collapsed `Developer sandbox` section. It uses default Hardhat accounts:

- Account 0: Admin
- Account 1: Manufacturer
- Account 2: Distributor
- Account 3: Retailer
- Account 4: Regulator
- Account 5: Consumer

Recommended local flow:

1. `Connect Sandbox Network`
2. `Assign Sandbox Roles`
3. `Run Manufacturer Step`
4. `Run Distributor Step`
5. `Run Retailer + Regulator Step`
6. Open `Batch Trace`
7. Open `Consumer Verify`
8. Run breach, recall, and unauthorized action checks if needed

## Backend API

Base URL locally:

```text
http://localhost:4000
```

Base URL on Vercel:

```text
https://coldchain-provenance.vercel.app
```

Routes:

- `GET /api/health`
- `POST /api/logs/upload`
- `POST /api/logs/simulate`
- `GET /api/logs/:filename`
- `POST /api/logs/verify`
- `GET /api/batches/:batchId/offchain-summary`

The API supports the required off-chain workflow: generate or upload IoT logs, calculate a `keccak256` digest, detect temperature breaches, store the raw log off-chain, return a URI/hash summary, and verify later whether a file still matches the expected digest.

Safe temperature range:

```text
2C to 8C
```

Any reading outside this range sets `breachFlag = true`.

## Testing

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

Run all tests:

```bash
npm run test:all
```

Build frontend:

```bash
npm --prefix frontend run build
```

Generate gas report:

```bash
npm run gas
```

## Deploy Smart Contract to Polygon Amoy

Create root `.env`:

```text
AMOY_RPC_URL=https://rpc-amoy.polygon.technology/
PRIVATE_KEY=<testnet deployer private key>
ADMIN_ADDRESS=<administrator wallet address>
```

The deployer wallet must have Amoy test `POL`.

Deploy:

```bash
npm run deploy -- --network amoy
```

Optional low gas-price deployment:

```bash
DEPLOY_GAS_PRICE_GWEI=25 npm run deploy -- --network amoy
```

On Windows PowerShell:

```powershell
$env:DEPLOY_GAS_PRICE_GWEI="25"
npm run deploy -- --network amoy
Remove-Item Env:DEPLOY_GAS_PRICE_GWEI
```

The deployment prints the contract address and writes it to:

```text
frontend/public/demo-contract.json
```

## Deploy Web App to Vercel

The project is configured for Vercel using:

- `vercel.json`
- `api/index.js`
- `frontend/dist` output
- same-domain API routing under `/api`

Required Vercel environment variables:

```text
VITE_RPC_URL=https://rpc-amoy.polygon.technology/
VITE_CONTRACT_ADDRESS=<deployed Amoy contract address>
AZURE_SQL_SERVER=<server>.database.windows.net
AZURE_SQL_DATABASE=<database name>
AZURE_SQL_USER=<sql username>
AZURE_SQL_PASSWORD=<sql password>
AZURE_SQL_ENCRYPT=true
AZURE_STORAGE_CONNECTION_STRING=<storage account connection string>
AZURE_STORAGE_CONTAINER=iot-logs
```

Leave `VITE_BACKEND_URL` blank on Vercel so the frontend uses same-domain `/api` routes.

Deploy:

```bash
npx vercel --prod
```

Current production URL:

```text
https://coldchain-provenance.vercel.app
```

## Azure SQL and Azure Blob Storage

The live deployment uses Azure Blob Storage and Azure SQL for off-chain data management.

When `AZURE_SQL_*` variables are configured, the backend stores IoT log metadata, hashes, breach summaries, and storage references in Azure SQL. The backend creates or updates the `dbo.IotLogs` table automatically if it does not exist.

Azure SQL Serverless may pause when idle. The backend retries transient wake-up failures, including error `40613`, before returning an API error.

When `AZURE_STORAGE_CONNECTION_STRING` is configured, raw IoT JSON/CSV files are stored in a private Azure Blob container, normally `iot-logs`. Azure SQL stores only metadata, hashes, and blob references. If Azure Blob Storage is not configured but Azure SQL is configured, the backend can store raw file bytes in Azure SQL for demo fallback. If neither Azure service is configured, the backend falls back to local file storage under `backend/src/uploads`.

Current live storage design:

```text
Raw IoT JSON/CSV file -> Azure Blob Storage
Metadata/hash/summary -> Azure SQL
Hash proof -> Polygon Amoy smart contract
```

## Security Notes

- Never commit private keys or real `.env` files.
- Use a demo deployer wallet for testnet deployment.
- Rotate any database password or storage key that was shared outside a secure channel.
- Public Azure SQL firewall access can support this course prototype, but a production deployment should restrict access with private networking or managed platform egress controls.
- Raw IoT files are stored in Azure Blob Storage when configured; SQL should store metadata rather than large telemetry files.

## Why Blockchain Helps

In a centralized tracker, one party can edit records without a shared immutable audit trail. This system uses smart contract transactions and events so each stakeholder action is attributable, ordered, and resistant to later alteration.

The blockchain does not prove a physical sensor is honest. It proves that a specific log digest was submitted by a specific authorized stakeholder at a specific point in the lifecycle. That is the provenance and tamper-evidence benefit demonstrated by this project.
