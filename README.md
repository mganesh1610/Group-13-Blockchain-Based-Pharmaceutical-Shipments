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

This file inlcudes:
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
backend/
frontend/
```

## Dependencies
Root:
- Node.js
- Hardhat
- OpenZeppelin Contracts
- Ethers v6

Backend:
- Express
- Multer
- CORS
- dotenv

Frontend:
- React
- Vite
- React Router

## Basic Setup
Install root dependencies:
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
cd ../frontend
npm install
```

## Basic Usage
Run tests:
```bash
npm test
```

Start local Hardhat node:
```bash
npx hardhat node
```

Deploy contract locally:
```bash
npm run deploy:local
```

Start backend:
```bash
cd backend
npm run dev
```

Start frontend:
```bash
cd frontend
npm run dev
```

## Notes for This Submission
This repo is still an early draft. The contract file currently focuses on structure and interfaces more than full business logic. The backend and frontend folders are added mainly to show the planned project structure and interfaces for the next implementation stage.


## Files to Check
- `contracts/SupplyChainProvenance.sol`
- `github-repository-link.txt`
