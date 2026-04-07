const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SupplyChainProvenance", function () {
  async function deployFixture() {
    const [admin, manufacturer, distributor, retailer, regulator, consumer] = await ethers.getSigners();

    const SupplyChainProvenance = await ethers.getContractFactory("SupplyChainProvenance");
    const contract = await SupplyChainProvenance.deploy(admin.address);
    await contract.waitForDeployment();

    await (await contract.grantRole(await contract.MANUFACTURER_ROLE(), manufacturer.address)).wait();
    await (await contract.grantRole(await contract.DISTRIBUTOR_ROLE(), distributor.address)).wait();
    await (await contract.grantRole(await contract.RETAILER_ROLE(), retailer.address)).wait();
    await (await contract.grantRole(await contract.REGULATOR_ROLE(), regulator.address)).wait();

    return { contract, admin, manufacturer, distributor, retailer, regulator, consumer };
  }

  it("registers a batch and stores the initial metadata", async function () {
    const { contract, manufacturer } = await deployFixture();

    await (
      await contract
        .connect(manufacturer)
        .registerBatch("BATCH001", "Insulin Shipment", "Phoenix, AZ", 1711929600)
    ).wait();

    const batch = await contract.getBatch("BATCH001");

    expect(batch.batchId).to.equal("BATCH001");
    expect(batch.productName).to.equal("Insulin Shipment");
    expect(batch.origin).to.equal("Phoenix, AZ");
    expect(batch.manufacturer).to.equal(manufacturer.address);
    expect(batch.currentCustodian).to.equal(manufacturer.address);
    expect(batch.exists).to.equal(true);
    expect(await contract.getBatchCount()).to.equal(1n);
  });

  it("prevents duplicate registration", async function () {
    const { contract, manufacturer } = await deployFixture();

    await (
      await contract
        .connect(manufacturer)
        .registerBatch("BATCH001", "Insulin Shipment", "Phoenix, AZ", 1711929600)
    ).wait();

    await expect(
      contract
        .connect(manufacturer)
        .registerBatch("BATCH001", "Duplicate Batch", "Phoenix, AZ", 1711929600)
    ).to.be.revertedWith("Batch already registered");
  });

  it("enforces role restrictions for registration", async function () {
    const { contract, distributor } = await deployFixture();

    await expect(
      contract
        .connect(distributor)
        .registerBatch("BATCH001", "Insulin Shipment", "Phoenix, AZ", 1711929600)
    ).to.be.reverted;
  });

  it("supports a minimal stakeholder workflow", async function () {
    const { contract, manufacturer, distributor, retailer, regulator } = await deployFixture();

    await (
      await contract
        .connect(manufacturer)
        .registerBatch("BATCH002", "Vaccine Shipment", "Tempe, AZ", 1712016000)
    ).wait();

    await (
      await contract
        .connect(manufacturer)
        .transferCustody("BATCH002", distributor.address, "Phoenix, AZ", "Released to distributor")
    ).wait();

    await (
      await contract
        .connect(distributor)
        .updateStatus("BATCH002", 1, "Shipment in transit")
    ).wait();

    const logHash = ethers.keccak256(ethers.toUtf8Bytes("BATCH002-log"));

    await (
      await contract
        .connect(distributor)
        .recordCondition(
          "BATCH002",
          logHash,
          "backend/uploads/BATCH002-normal.json",
          false,
          "No temperature breach detected"
        )
    ).wait();

    await (
      await contract
        .connect(distributor)
        .transferCustody("BATCH002", retailer.address, "Tempe, AZ", "Delivered to retailer")
    ).wait();

    await (
      await contract
        .connect(retailer)
        .updateStatus("BATCH002", 4, "Delivered to retailer")
    ).wait();

    await (
      await contract
        .connect(regulator)
        .addVerification("BATCH002", "Compliance Review", true, "Approved for release")
    ).wait();

    const batch = await contract.getBatch("BATCH002");
    const custodyHistory = await contract.getCustodyHistory("BATCH002");
    const conditionHistory = await contract.getConditionHistory("BATCH002");
    const verificationHistory = await contract.getVerificationHistory("BATCH002");

    expect(Number(batch.status)).to.equal(4);
    expect(batch.currentCustodian).to.equal(retailer.address);
    expect(custodyHistory.length).to.equal(2);
    expect(conditionHistory.length).to.equal(1);
    expect(verificationHistory.length).to.equal(1);
  });

  it("flags a batch automatically when a breach is recorded", async function () {
    const { contract, manufacturer, distributor } = await deployFixture();

    await (
      await contract
        .connect(manufacturer)
        .registerBatch("BATCH003", "Sensitive Medication", "Mesa, AZ", 1712102400)
    ).wait();

    await (
      await contract
        .connect(manufacturer)
        .transferCustody("BATCH003", distributor.address, "Mesa, AZ", "Released to distributor")
    ).wait();

    await (
      await contract
        .connect(distributor)
        .recordCondition(
          "BATCH003",
          ethers.keccak256(ethers.toUtf8Bytes("BATCH003-breach-log")),
          "backend/uploads/BATCH003-severe.json",
          true,
          "Max temp 11.2C, breach detected"
        )
    ).wait();

    const batch = await contract.getBatch("BATCH003");
    expect(Number(batch.status)).to.equal(5);
  });
});
