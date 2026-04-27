# Blockchain-Based Cold Chain Provenance System for Pharmaceutical Shipments

## Project Description

This project is a blockchain-powered supply chain provenance system for temperature-sensitive pharmaceutical shipments. It tracks a product batch from manufacturer registration through distributor shipment, IoT condition logging, retailer delivery, regulator verification, recall handling, and public consumer verification.

The goal is to show why blockchain is useful for multi-party supply chain traceability. The smart contract records role-controlled lifecycle events, custody transfers, condition log hashes, regulator decisions, and recall actions. Raw IoT logs are stored off-chain and verified by comparing their `keccak256` hash with the digest anchored on-chain.

Live deployment:

- Public GitHub repository: [https://github.com/mganesh1610/Group-13-Blockchain-Based-Pharmaceutical-Shipments](https://github.com/mganesh1610/Group-13-Blockchain-Based-Pharmaceutical-Shipments)
- Web app: [https://coldchain-provenance.vercel.app](https://coldchain-provenance.vercel.app)
- Polygon Amoy contract: `0xAFdcF244CAb9d632946c42A07463F3105B605EF0`
- Amoy explorer: [View verified contract on PolygonScan](https://amoy.polygonscan.com/address/0xAFdcF244CAb9d632946c42A07463F3105B605EF0)

Recommended grading path:

1. Open the live web app.
2. Add Polygon Amoy Testnet to MetaMask using the network settings below.
3. Import the grader admin wallet and stakeholder wallets provided in the private Canvas submission notes.
4. Connect the admin wallet first and grant roles to the stakeholder public addresses listed in this README.
5. Switch MetaMask between the manufacturer, distributor, retailer, and regulator wallets to run the role-specific workflow.
6. Use `Batch Trace`, `Consumer Verify`, and `Tamper Check` to inspect the proof trail.

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

Current live UI behavior:

- `Admin` sees `Admin Access` plus public/read-only pages.
- `Manufacturer` sees batch registration and custody-transfer actions.
- `Distributor` sees custody transfer, status update, and condition-log actions.
- `Retailer` sees status update and condition-log actions.
- `Regulator` sees regulator review actions.
- `Consumer` does not need a role or wallet for public verification.

If an admin wallet also shows manufacturer, distributor, retailer, or regulator pages, that means the wallet has also been granted those on-chain roles. Use `Admin Access` to remove extra operational roles if strict role separation is desired.

Notification banners clear automatically when moving between app sections, so a message from one workflow does not stay visible on another page.

Role-specific lifecycle behavior:

- The contract does not decide that an address is a distributor or retailer based only on transfer order.
- A wallet represents a stakeholder because the admin granted that wallet the matching on-chain role.
- Custody transfer moves the batch to a recipient wallet address.
- The recipient wallet's granted role determines what pages and contract actions become available after connection.
- Distributor status updates are normally used for shipment and storage activity.
- Retailer status updates are normally used for receipt and final delivery.
- Regulator actions are separated from logistics actions and are used for verification or recall.

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

For a fresh clone, this deploys with Hardhat Account 0 as the local admin. If you already created a root `.env` for Polygon Amoy and it contains `ADMIN_ADDRESS`, temporarily remove that value for local sandbox testing or override it for the deploy command:

```powershell
$env:ADMIN_ADDRESS="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; npm run deploy:local
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

The `Developer sandbox` panel is designed for local grading checks. `Connect Sandbox Network` switches the app to `http://127.0.0.1:8545` and loads the local deployment from `frontend/public/demo-contract.json`. If the contract field still shows the Polygon Amoy address, click `Connect Sandbox Network` again or paste the local Hardhat contract address printed by `npm run deploy:local`.

MetaMask does not allow a web page to import a wallet automatically. After `Connect Sandbox Network`, expand `Sandbox stakeholder addresses` in the left sidebar and use `Copy test key` for the local Hardhat account you want to import. Paste that key into MetaMask using `Import account`. These keys are only the public Hardhat development keys and must never be used on a real network.

MetaMask may rename imported accounts as `Imported Account 1`, `Imported Account 2`, and so on. That display name does not need to match the Hardhat account number. Verify the wallet by comparing the address: the local admin is `0xf39F...92266`, manufacturer is `0x7099...79C8`, distributor is `0x3C44...93BC`, retailer is `0x90F7...b906`, and regulator is `0x15d3...6A65`.

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
4. Use `Admin Access` from the admin wallet to grant or remove stakeholder roles.
5. Switch MetaMask to the manufacturer wallet and use `Register Batch` to create a pharmaceutical batch.
6. From the current custodian wallet, use `Transfer Custody` to move the batch to the next stakeholder wallet address.
7. Switch MetaMask to the distributor wallet and use `Status Update` to mark shipment progress.
8. Use `Condition Logs` as the distributor or retailer to generate/upload IoT logs and anchor their hash on-chain.
9. Switch MetaMask to the retailer wallet and use `Status Update` to mark receipt or delivery.
10. Switch MetaMask to the regulator wallet and use `Regulator Review` to add verification or recall a batch.
11. Use `Batch Trace` to view the full provenance timeline.
12. Use `Consumer Verify` or the QR route for a simplified read-only public verification view without requiring a wallet.
13. Use `Tamper Check` to load the latest condition proof for a batch and compare the off-chain file with the on-chain hash.
14. Use `Switch Wallet` or `Logout` when moving between stakeholder accounts.

The navigation changes based on the connected wallet role. Unassigned wallets only see public/read-only pages. Stakeholder wallets see the pages matching their assigned roles. The contract does not infer distributor or retailer from transfer order alone; the recipient wallet's granted role determines what stakeholder it represents.

## Tamper Evidence Flow

The `Tamper Check` page demonstrates that raw IoT data can stay off-chain while still being verifiable.

1. Enter a batch ID such as `BATCH001`.
2. Click `Load Latest Condition Proof`.
3. The app reads the latest `ConditionRecord` from the smart contract and fills in the anchored `logHash` and stored filename.
4. Click `Run Hash Verification`.
5. The backend fetches the raw IoT log from Azure Blob Storage or local storage, recomputes the `keccak256` hash, and compares it with the on-chain digest.
6. A valid unmodified file shows `MATCH`.
7. A changed or different file shows `MISMATCH`.

This check is read-only and does not open MetaMask because it does not write a blockchain transaction. It is a backend verification against an existing on-chain proof.

`Batch Trace` is the full auditor view. It shows batch metadata, wallet addresses, custody chain, condition proofs, verification records, recall records, and the QR route. `Consumer Verify` is intentionally simpler. It summarizes whether a buyer or receiving party should trust the batch, whether a warning or recall exists, and the high-level supply-chain path.

## Grader Live Testing

The live deployment is available at:

```text
https://coldchain-provenance.vercel.app
```

The deployed Polygon Amoy contract is:

```text
0xAFdcF244CAb9d632946c42A07463F3105B605EF0
```

For grading, test wallet private keys are provided separately through the private Canvas submission notes. Private keys are intentionally not committed to this public repository. The public addresses below are safe to include because they are used for role assignment on-chain.

The following public addresses are currently recognized by the deployed Polygon Amoy contract. If a wallet does not show the expected role after import, connect an admin wallet and use `Admin Access` to grant the matching role again.

| Stakeholder | Public Wallet Address | Role to Grant |
| --- | --- | --- |
| Admin | `0x106740923A201aCCcE412911880161760ce8B2BD` | Already contract admin |
| Grader Admin | `0x9287E3aAB5c5939845409fd7C16044FA7eBE3B1e` | Already contract admin |
| Manufacturer | `0x1AD47A780fD10074804b9b60B370FEcf4c6758A0` | `Manufacturer` |
| Distributor | `0xce03c80C3bAac6e8A3c45fD921F090F5AEAc4066` | `Distributor` |
| Retailer | `0x2aa428655a6F04607795b1F639307ba2F4b981EA` | `Retailer` |
| Regulator | `0x034e46defEb4ef20452B795E7Ae6263444dbAad2` | `Regulator` |
| Consumer | Any wallet or no wallet | No role required |

Live grading setup:

1. Open MetaMask.
2. Add the `Polygon Amoy Testnet` network using the details in the section above.
3. Import the admin and stakeholder wallets using the private keys provided in the Canvas submission notes.
4. Switch MetaMask to `Polygon Amoy Testnet`.
5. Open [https://coldchain-provenance.vercel.app](https://coldchain-provenance.vercel.app).
6. Connect the admin wallet.
7. Open `Admin Access`.
8. Confirm that `Manufacturer`, `Distributor`, `Retailer`, and `Regulator` roles are granted to the public addresses in the table above. If needed, grant the missing role from `Admin Access`.
9. Switch MetaMask to the manufacturer wallet and reconnect in the app.
10. Register a new batch ID, for example `BATCH` followed by the current time.
11. Transfer custody from the manufacturer wallet to the distributor public address.
12. Switch to the distributor wallet, update status to `Shipped`, generate or upload an IoT log in `Condition Logs`, and anchor the condition record.
13. Transfer custody from the distributor wallet to the retailer public address.
14. Switch to the retailer wallet and update status to `Received` or `Delivered`.
15. Switch to the regulator wallet and add a verification or recall action.
16. Use `Batch Trace`, `Consumer Verify`, and `Tamper Check` to inspect the final proof trail.

For the cleanest role-specific demonstration, use separate wallets for each stakeholder. If one wallet has multiple roles, the app will show the combined menu for those roles because the deployed smart contract recognizes every role assigned to that address.

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

If `Assign Sandbox Roles` shows a decode or unauthorized error, check two things:

- The local Hardhat node must still be running at `http://127.0.0.1:8545`.
- The contract field in `Edit connection details` must be the local deployment, normally `0x5FbDB2315678afecb367f032d93F642f64180aa3`, not the Polygon Amoy contract address.

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
POLYGONSCAN_API_KEY=<polygonscan api key for contract verification>
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

## Verify Contract on PolygonScan

PolygonScan can show readable function names and event logs only after the deployed contract source is verified. Without verification, transactions still exist on-chain, but the explorer may show raw method selectors such as `0xa97e4d3e` and raw event topics.

Create a free PolygonScan account and API key, then add it to the root `.env`:

```text
POLYGONSCAN_API_KEY=<your polygonscan api key>
```

Verify the deployed Polygon Amoy contract:

```bash
npx hardhat verify --network polygonAmoy 0xAFdcF244CAb9d632946c42A07463F3105B605EF0 0x106740923A201aCCcE412911880161760ce8B2BD
```

The second address is the constructor argument for `SupplyChainProvenance`, which is the admin wallet used during deployment. If a different admin was used for a future deployment, replace that address with the admin constructor argument printed by `scripts/deploy.js`.

The live project contract has already been verified. Open:

```text
https://amoy.polygonscan.com/address/0xAFdcF244CAb9d632946c42A07463F3105B605EF0#events
```

PolygonScan should then decode events such as `BatchRegistered`, `CustodyTransferred`, `ConditionRecorded`, `VerificationAdded`, and `BatchRecalled`.

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
- Never place grader wallet private keys in `README.md`, source code, screenshots, or commit history. Provide them only through the private Canvas submission notes.
- Use a demo deployer wallet for testnet deployment.
- Rotate any database password or storage key that was shared outside a secure channel.
- Public Azure SQL firewall access can support this course prototype, but a production deployment should restrict access with private networking or managed platform egress controls.
- Raw IoT files are stored in Azure Blob Storage when configured; SQL should store metadata rather than large telemetry files.

## Why Blockchain Helps

In a centralized tracker, one party can edit records without a shared immutable audit trail. This system uses smart contract transactions and events so each stakeholder action is attributable, ordered, and resistant to later alteration.

The blockchain does not prove a physical sensor is honest. It proves that a specific log digest was submitted by a specific authorized stakeholder at a specific point in the lifecycle. That is the provenance and tamper-evidence benefit demonstrated by this project.
