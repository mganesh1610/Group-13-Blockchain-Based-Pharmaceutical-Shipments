# Minimal Demo Flow

This is the smallest current workflow that can be shown during the interim presentation.

## Goal

Demonstrate one clear stakeholder flow using the smart contract and local Hardhat runtime:

1. admin deploys the contract
2. admin grants roles
3. manufacturer registers a batch
4. manufacturer transfers custody to distributor
5. distributor updates status and records a condition log hash
6. retailer receives the batch
7. regulator adds a verification record
8. presenter shows the final batch summary in terminal output

## Commands

Run these before recording:

```bash
npm install
npm test
npm run demo:flow
```

For the browser demo:

```bash
npm run node
npm run deploy:local
cd frontend
npm install
npm run dev
```

## What to Show in the Recording

### Terminal demo

Show the output of:

- `npm test`
- `npm run demo:flow`

This demonstrates that the contract logic is functional for the current milestone.

### Browser demo

Open the local Vite URL after starting the frontend and show this flow:

1. Click `Connect to Local Node`
2. Click `Grant Demo Roles`
3. Click `Register Batch as Manufacturer`
4. Click `Transfer to Distributor + Anchor Condition`
5. Click `Deliver to Retailer + Regulator Verify`
6. Click `Refresh Batch Details`

This gives you a small UI-based stakeholder workflow for the recording while staying aligned with the same contract logic used in the terminal demo.

### Code walkthrough files

Show these files briefly:

- `contracts/SupplyChainProvenance.sol`
- `scripts/demoFlow.js`
- `test/SupplyChainProvenance.test.js`
- `README.md`

## Suggested Talking Points

- The contract now supports one working batch lifecycle flow for the demo
- Role-based permissions are enforced with OpenZeppelin `AccessControl`
- The project still has planned backend and frontend work remaining
- The interim milestone focuses on the core provenance logic first
