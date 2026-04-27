require("@nomicfoundation/hardhat-toolbox");
require("hardhat-gas-reporter");
require("dotenv").config();

const { AMOY_RPC_URL, PRIVATE_KEY, POLYGONSCAN_API_KEY } = process.env;
const networks = {};

if (AMOY_RPC_URL) {
  const amoyNetwork = {
    url: AMOY_RPC_URL,
    chainId: 80002,
    accounts: PRIVATE_KEY ? [PRIVATE_KEY] : []
  };

  networks.amoy = amoyNetwork;
  networks.polygonAmoy = amoyNetwork;
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
  etherscan: {
    apiKey: POLYGONSCAN_API_KEY || ""
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
    showTimeSpent: true
  }
};
