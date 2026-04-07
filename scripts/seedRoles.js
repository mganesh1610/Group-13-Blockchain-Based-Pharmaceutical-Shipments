const hre = require("hardhat");

async function main() {
  const contractAddress = process.env.CONTRACT_ADDRESS;

  if (!contractAddress) {
    throw new Error("Set CONTRACT_ADDRESS in your environment before running seedRoles.");
  }

  const [admin, manufacturer, distributor, retailer, regulator] = await hre.ethers.getSigners();
  const contract = await hre.ethers.getContractAt("SupplyChainProvenance", contractAddress);

  const manufacturerRole = await contract.MANUFACTURER_ROLE();
  const distributorRole = await contract.DISTRIBUTOR_ROLE();
  const retailerRole = await contract.RETAILER_ROLE();
  const regulatorRole = await contract.REGULATOR_ROLE();

  await (await contract.connect(admin).grantRole(manufacturerRole, manufacturer.address)).wait();
  await (await contract.connect(admin).grantRole(distributorRole, distributor.address)).wait();
  await (await contract.connect(admin).grantRole(retailerRole, retailer.address)).wait();
  await (await contract.connect(admin).grantRole(regulatorRole, regulator.address)).wait();

  console.log("Roles granted");
  console.log("  Manufacturer:", manufacturer.address);
  console.log("  Distributor:", distributor.address);
  console.log("  Retailer:", retailer.address);
  console.log("  Regulator:", regulator.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
