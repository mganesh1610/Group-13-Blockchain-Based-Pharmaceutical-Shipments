const hre = require("hardhat");

const STATUS_LABELS = ["Created", "Shipped", "Received", "Stored", "Delivered", "Flagged"];

async function main() {
  const [admin, manufacturer, distributor, retailer, regulator] = await hre.ethers.getSigners();

  const SupplyChainProvenance = await hre.ethers.getContractFactory("SupplyChainProvenance");
  const contract = await SupplyChainProvenance.deploy(admin.address);
  await contract.waitForDeployment();

  const manufacturerRole = await contract.MANUFACTURER_ROLE();
  const distributorRole = await contract.DISTRIBUTOR_ROLE();
  const retailerRole = await contract.RETAILER_ROLE();
  const regulatorRole = await contract.REGULATOR_ROLE();

  await (await contract.grantRole(manufacturerRole, manufacturer.address)).wait();
  await (await contract.grantRole(distributorRole, distributor.address)).wait();
  await (await contract.grantRole(retailerRole, retailer.address)).wait();
  await (await contract.grantRole(regulatorRole, regulator.address)).wait();

  console.log("Contract deployed to:", await contract.getAddress());
  console.log("Roles seeded for demo accounts.");

  await (
    await contract
      .connect(manufacturer)
      .registerBatch("BATCH001", "Pfizer Vaccine Batch", "Phoenix, AZ", 1711929600)
  ).wait();
  console.log("1. Manufacturer registered BATCH001");

  await (
    await contract
      .connect(manufacturer)
      .transferCustody("BATCH001", distributor.address, "Phoenix, AZ", "Handed to distributor")
  ).wait();
  console.log("2. Manufacturer transferred custody to distributor");

  await (
    await contract
      .connect(distributor)
      .updateStatus("BATCH001", 1, "Shipment is now in transit")
  ).wait();
  console.log("3. Distributor updated status to Shipped");

  const logHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("BATCH001-normal-log"));

  await (
    await contract
      .connect(distributor)
      .recordCondition(
        "BATCH001",
        logHash,
        "backend/uploads/BATCH001-normal.json",
        false,
        "12 readings, max temp 6.8C, no breach detected"
      )
  ).wait();
  console.log("4. Distributor anchored a normal IoT condition log");

  await (
    await contract
      .connect(distributor)
      .transferCustody("BATCH001", retailer.address, "Tempe, AZ", "Delivered to retailer")
  ).wait();

  await (
    await contract
      .connect(retailer)
      .updateStatus("BATCH001", 4, "Batch delivered to retailer")
  ).wait();
  console.log("5. Retailer received the batch and marked it Delivered");

  await (
    await contract
      .connect(regulator)
      .addVerification("BATCH001", "Temperature Compliance", true, "Cold chain log reviewed")
  ).wait();
  console.log("6. Regulator added a compliance verification");

  const batch = await contract.getBatch("BATCH001");
  const custodyHistory = await contract.getCustodyHistory("BATCH001");
  const conditionHistory = await contract.getConditionHistory("BATCH001");
  const verificationHistory = await contract.getVerificationHistory("BATCH001");

  console.log("\nFinal batch summary");
  console.log("  Batch ID:", batch.batchId);
  console.log("  Product:", batch.productName);
  console.log("  Status:", STATUS_LABELS[Number(batch.status)]);
  console.log("  Current Custodian:", batch.currentCustodian);
  console.log("  Custody records:", custodyHistory.length);
  console.log("  Condition records:", conditionHistory.length);
  console.log("  Verification records:", verificationHistory.length);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
