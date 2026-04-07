# Blockchain-Based Cold Chain Provenance System for Pharmaceutical Shipments

## Project Idea
This project is for a blockchain supply chain provenance system focused on pharmaceutical cold-chain shipments. The main idea is to track a batch from manufacturer to distributor to retailer, and to let a regulator and consumer verify the history later.

## Problem the Project Is Solving
Pharmaceutical shipments need temperature control during storage and transport. If the temperature goes out of the safe range, the product may no longer be safe. In a normal centralized system, one party usually controls the records. In this project, blockchain is used to make the lifecycle events more transparent and harder to tamper with across multiple parties.

## Main Roles
- Admin
- Manufacturer
- Distributor
- Retailer
- Regulator
- Consumer

The consumer is read-only. The other roles perform updates based on their part in the supply chain.

## Planned Workflow
1. Manufacturer registers a batch.
2. Custody is transferred to the distributor.
3. Distributor uploads or generates an IoT temperature log.
4. The backend stores the raw log off-chain and returns a hash.
5. The hash and file URI are recorded on-chain.
6. Retailer receives the batch and updates status.
7. Regulator adds a verification record.
8. Consumer checks provenance using the batch ID.

## Contract Draft
Main contract:
- `SupplyChainProvenance`

Main enum:
- `Created`
- `Shipped`
- `Received`
- `Stored`
- `Delivered`
- `Flagged`

Main structs:
- `ProductBatch`
- `CustodyRecord`
- `ConditionRecord`
- `VerificationRecord`

Main functions:
```solidity
function registerBatch(
    string memory batchId,
    string memory productName,
    string memory origin,
    uint256 manufactureDate
) external;

function transferCustody(
    string memory batchId,
    address to,
    string memory location,
    string memory notes
) external;

function updateStatus(
    string memory batchId,
    uint8 newStatus,
    string memory notes
) external;

function recordCondition(
    string memory batchId,
    bytes32 logHash,
    string memory logURI,
    bool breachFlag,
    string memory summary
) external;

function addVerification(
    string memory batchId,
    string memory verificationType,
    bool result,
    string memory remarks
) external;
```

The main file to check this contract draft is:
- `contracts/SupplyChainProvenance.sol`

This file includes:
- Draft Contract Code
- Signatures/interfaces of contract components
- High-level comments explaining functionality of the component

## Why Some Data Is Off-Chain
The raw IoT files are not meant to be stored directly on-chain because that would cost more gas and make the contract heavier. Instead, the backend stores the raw file and computes a `keccak256` hash. That hash is what gets anchored on-chain.

Verification idea:
1. download the raw file
2. hash it again
3. compare the new hash with the on-chain hash

## Current Folder Structure
```text
contracts/
  SupplyChainProvenance.sol
scripts/
  deploy.js
  seedRoles.js
  demoFlow.js
test/
  SupplyChainProvenance.test.js
backend/
  src/
    uploads/
frontend/
  index.html
  package.json
  vite.config.js
docs/
  demo-flow.md
  interim-demo-guide.md
package.json
hardhat.config.js
```

## Dependencies
Root blockchain demo:
- Node.js
- Hardhat
- OpenZeppelin Contracts
- Ethers v6 (through Hardhat toolbox)
- dotenv

Backend (planned next stage):
- Express
- Multer
- CORS
- dotenv

Frontend (planned next stage):
- React
- Vite
- React Router

## Current Working Demo
This repository now includes a minimal runnable blockchain demo for the interim presentation.

The current implemented flow is:
1. Admin deploys the contract and grants stakeholder roles.
2. Manufacturer registers a batch.
3. Manufacturer transfers custody to the distributor.
4. Distributor updates shipment status and anchors a condition log hash.
5. Retailer receives the batch and marks it delivered.
6. Regulator adds a verification record.
7. The final batch summary is read back from the contract.

## Current Demo Commands
Install dependencies:
```bash
npm install
```

Run automated contract tests:
```bash
npm test
```

Run the interim demo flow:
```bash
npm run demo:flow
```

Optional browser demo:
```bash
npm run node
npm run deploy:local
cd frontend
npm install
npm run dev
```

The browser demo provides a small visual workflow for the same stakeholder sequence using a local Hardhat node and the deployed contract address saved into `frontend/public/demo-contract.json`.

## Planned Next Stage
These parts are still planned and not yet fully implemented:
- Express backend for IoT file upload and hashing
- Simulated IoT log generation routes
- Frontend pages for batch registration and consumer verification
- Wallet-based blockchain interaction from the UI

## Notes for This Submission
This repo is an interim milestone submission. The smart contract, local demo script, and automated tests now support a small working stakeholder flow for presentation. The backend and frontend folders remain part of the planned next implementation stage.


## Files to Check
- `contracts/SupplyChainProvenance.sol`
- `scripts/demoFlow.js`
- `test/SupplyChainProvenance.test.js`
- `docs/demo-flow.md`
- `Group-13-github-repository-link.txt`
