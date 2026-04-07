# Interim Demo Guide

This document is meant to support the 5-minute interim presentation for the project:

`Blockchain-Based Cold Chain Provenance System for Pharmaceutical Shipments`

The goal of the interim demo is to clearly explain:

- what has already been implemented
- what is still in progress
- how the current code maps to the proposed stakeholder workflow

## 1. Current Project Status

### Implemented Now

- Public GitHub repository with project structure
- Project README with scope, workflow, dependencies, and design notes
- Working smart contract file: `contracts/SupplyChainProvenance.sol`
- Defined stakeholder roles:
  - Admin
  - Manufacturer
  - Distributor
  - Retailer
  - Regulator
  - Consumer
- Defined lifecycle statuses:
  - Created
  - Shipped
  - Received
  - Stored
  - Delivered
  - Flagged
- Defined contract data structures:
  - `ProductBatch`
  - `CustodyRecord`
  - `ConditionRecord`
  - `VerificationRecord`
- Implemented core contract events and functions for a local demo flow
- Local Hardhat demo script in `scripts/demoFlow.js`
- Automated smart contract tests in `test/SupplyChainProvenance.test.js`
- Initial frontend scaffold files in `frontend/`
- Backend uploads folder scaffold in `backend/src/uploads/`

### In Progress

- Backend routes for simulated IoT log upload and hashing
- Frontend pages for batch registration, custody transfer, status updates, and consumer verification
- Wallet integration and on-chain interaction from the UI

### Remaining

- Contract deployment script and local demo flow
- Backend API implementation
- Complete frontend implementation
- Automated tests
- Full end-to-end demo with on-chain and off-chain integration

## 2. Stakeholder Interaction Summary

### Manufacturer

- Intended role: register a pharmaceutical batch
- Current progress: role and function signature are defined in the smart contract draft
- Related function: `registerBatch(...)`

### Distributor

- Intended role: receive custody, update shipment state, and anchor IoT log hashes
- Current progress: custody, status, and condition record structures are defined
- Related functions:
  - `transferCustody(...)`
  - `updateStatus(...)`
  - `recordCondition(...)`

### Retailer

- Intended role: confirm later-stage receipt and final product handling
- Current progress: supported in the role model and lifecycle design

### Regulator

- Intended role: add compliance or verification records
- Current progress: regulator role and verification function are defined
- Related function: `addVerification(...)`

### Consumer

- Intended role: read-only provenance checking
- Current progress: planned read functions are defined for traceability lookup

## 3. High-Level Code Walkthrough

During the presentation, focus on these files:

### `README.md`

Use this file to explain:

- project goal
- why blockchain is being used
- stakeholder workflow
- on-chain vs off-chain split
- current implementation scope versus future work

### `contracts/SupplyChainProvenance.sol`

Use this file to explain:

- role-based access control with `AccessControl`
- lifecycle status enum
- batch, custody, condition, and verification data structures
- major events emitted for transparency
- implemented write functions for the current demo flow
- implemented read functions for provenance lookup

### `scripts/demoFlow.js`

Use this file to explain:

- how the contract is deployed locally
- how roles are seeded for demo accounts
- how one batch moves across multiple stakeholders
- how the final batch summary is read back from the contract

### `test/SupplyChainProvenance.test.js`

Use this file to explain:

- duplicate prevention
- role restriction checks
- minimal stakeholder workflow coverage
- breach flag behavior

### `frontend/`

Use this folder to explain:

- frontend technology choice: React + Vite
- that the UI structure has been started but is not yet fully implemented

### `backend/src/uploads/`

Use this folder to explain:

- the intended off-chain approach for IoT logs
- raw files will be stored off-chain
- only the file hash and URI will be anchored on-chain

## 4. Suggested 5-Minute Presentation Flow

### 0:00 to 0:45 - Project Overview

Explain:

- project title
- why pharmaceutical cold-chain provenance matters
- why blockchain helps with tamper resistance and traceability

### 0:45 to 1:45 - Current Status

Explain:

- what is already implemented
- what is in progress
- what still remains

Keep this explicit and structured:

- implemented
- in progress
- remaining

### 1:45 to 3:15 - Contract and Stakeholder Interactions

Open `contracts/SupplyChainProvenance.sol` and explain:

- roles
- statuses
- structs
- events
- core functions

Then connect them to the stakeholder journey:

1. manufacturer registers a batch
2. distributor takes custody
3. distributor updates the shipment state
4. a condition log hash is anchored on-chain
5. retailer receives shipment
6. regulator verifies compliance

### 3:15 to 4:30 - High-Level Code Walkthrough

Show:

- `README.md`
- `contracts/SupplyChainProvenance.sol`
- `scripts/demoFlow.js`
- `test/SupplyChainProvenance.test.js`

Briefly explain how the components are intended to work together.

### 4:30 to 5:00 - Wrap-Up

Conclude with:

- current milestone reached
- what will be built next
- how the final version will support a fuller end-to-end demo

## 5. Recommended Talking Style

- Keep the explanation honest and simple
- Say clearly what is implemented now and what is still planned
- Do not claim the full backend or frontend is complete
- Use concrete examples like `BATCH001`
- Focus on one clear cold-chain batch lifecycle example

## 6. Suggested Closing Line

"At this interim stage, the project has the core blockchain data model, stakeholder roles, lifecycle design, and repository structure in place. The next milestone is connecting the smart contract draft with backend IoT log handling and a simple frontend workflow for end-to-end provenance verification."
