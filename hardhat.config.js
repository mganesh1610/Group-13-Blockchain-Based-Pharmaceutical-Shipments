require("@nomicfoundation/hardhat-toolbox");
require("hardhat-gas-reporter");
require("dotenv").config();

const { AMOY_RPC_URL, PRIVATE_KEY } = process.env;
const networks = {};

if (AMOY_RPC_URL) {
  networks.amoy = {
    url: AMOY_RPC_URL,
    chainId: 80002,
    accounts: PRIVATE_KEY ? [PRIVATE_KEY] : []
  };
}

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks,
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
    showTimeSpent: true
  }
};
