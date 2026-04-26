const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const adminAddress = process.env.ADMIN_ADDRESS || deployer.address;
  const deployOptions = {};

  if (process.env.DEPLOY_GAS_PRICE_GWEI) {
    deployOptions.gasPrice = hre.ethers.parseUnits(process.env.DEPLOY_GAS_PRICE_GWEI, "gwei");
  }

  const SupplyChainProvenance = await hre.ethers.getContractFactory("SupplyChainProvenance");
  const contract = await SupplyChainProvenance.deploy(adminAddress, deployOptions);
  await contract.waitForDeployment();

  console.log("SupplyChainProvenance deployed");
  console.log("  Deployer:", deployer.address);
  console.log("  Admin:", adminAddress);
  console.log("  Contract:", await contract.getAddress());

  const frontendPublicDir = path.join(__dirname, "..", "frontend", "public");
  fs.mkdirSync(frontendPublicDir, { recursive: true });
  fs.writeFileSync(
    path.join(frontendPublicDir, "demo-contract.json"),
    JSON.stringify(
      {
        contractAddress: await contract.getAddress(),
        adminAddress,
        deployedAt: new Date().toISOString()
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
