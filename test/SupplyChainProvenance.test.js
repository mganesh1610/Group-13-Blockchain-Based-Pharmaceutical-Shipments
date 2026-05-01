const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SupplyChainProvenance", function () {
  const Status = {
    Created: 0,
    Shipped: 1,
    Received: 2,
    Stored: 3,
    Delivered: 4,
    Flagged: 5,
    Recalled: 6
  };

  async function deployFixture() {
    const [admin, manufacturer, distributor, retailer, regulator, consumer, outsider] = await ethers.getSigners();

    const SupplyChainProvenance = await ethers.getContractFactory("SupplyChainProvenance");
    const contract = await SupplyChainProvenance.deploy(admin.address);
    await contract.waitForDeployment();

    await (await contract.grantRole(await contract.MANUFACTURER_ROLE(), manufacturer.address)).wait();
    await (await contract.grantRole(await contract.DISTRIBUTOR_ROLE(), distributor.address)).wait();
    await (await contract.grantRole(await contract.RETAILER_ROLE(), retailer.address)).wait();
    await (await contract.grantRole(await contract.REGULATOR_ROLE(), regulator.address)).wait();

    return { contract, admin, manufacturer, distributor, retailer, regulator, consumer, outsider };
  }

  async function registerBatch(contract, manufacturer, batchId = "BATCH001") {
    await (
      await contract
        .connect(manufacturer)
        .registerBatch(batchId, "Temperature Sensitive Vaccine", "Phoenix, AZ", 1775001600)
    ).wait();
  }

  async function moveToDistributor(contract, manufacturer, distributor, batchId = "BATCH001") {
    await registerBatch(contract, manufacturer, batchId);

    await (
      await contract
        .connect(manufacturer)
        .transferCustody(batchId, distributor.address, "Phoenix, AZ", "Released to distributor")
    ).wait();

    await (await contract.connect(distributor).updateStatus(batchId, Status.Shipped, "Shipment in transit")).wait();
  }

  it("registers a batch and stores initial provenance metadata", async function () {
    const { contract, manufacturer } = await deployFixture();

    await expect(
      contract
        .connect(manufacturer)
        .registerBatch("BATCH001", "Insulin Shipment", "Phoenix, AZ", 1775001600)
    )
      .to.emit(contract, "BatchRegistered")
      .withArgs("BATCH001", manufacturer.address);

    const batch = await contract.getBatch("BATCH001");

    expect(batch.batchId).to.equal("BATCH001");
    expect(batch.productName).to.equal("Insulin Shipment");
    expect(batch.origin).to.equal("Phoenix, AZ");
    expect(batch.manufacturer).to.equal(manufacturer.address);
    expect(batch.currentCustodian).to.equal(manufacturer.address);
    expect(Number(batch.status)).to.equal(Status.Created);
    expect(batch.exists).to.equal(true);
    expect(batch.recalled).to.equal(false);
    expect(batch.lastStatusNote).to.equal("Batch created");
    expect(await contract.getBatchCount()).to.equal(1n);
    expect(await contract.batchExists("BATCH001")).to.equal(true);
  });

  it("prevents duplicate registration", async function () {
    const { contract, manufacturer } = await deployFixture();

    await registerBatch(contract, manufacturer, "BATCH001");

    await expect(
      contract
        .connect(manufacturer)
        .registerBatch("BATCH001", "Duplicate Batch", "Phoenix, AZ", 1775001600)
    ).to.be.revertedWith("Batch already registered");
  });

  it("enforces role restrictions for manufacturer-only registration", async function () {
    const { contract, distributor } = await deployFixture();

    await expect(
      contract
        .connect(distributor)
        .registerBatch("BATCH001", "Insulin Shipment", "Phoenix, AZ", 1775001600)
    ).to.be.reverted;
  });

  it("preserves complete custody, condition, and regulator verification history", async function () {
    const { contract, manufacturer, distributor, retailer, regulator } = await deployFixture();

    await moveToDistributor(contract, manufacturer, distributor, "BATCH001");

    const logHash = ethers.keccak256(ethers.toUtf8Bytes("BATCH001-normal-log"));

    await (
      await contract
        .connect(distributor)
        .recordCondition(
          "BATCH001",
          logHash,
          "backend/src/uploads/BATCH001-normal.json",
          false,
          "12 readings, min 3.1C, max 7.8C, compliant"
        )
    ).wait();

    await (
      await contract
        .connect(distributor)
        .transferCustody("BATCH001", retailer.address, "Tempe, AZ", "Delivered to retailer")
    ).wait();

    await (await contract.connect(retailer).updateStatus("BATCH001", Status.Received, "Received by retailer")).wait();
    await (await contract.connect(retailer).updateStatus("BATCH001", Status.Delivered, "Ready for dispensing")).wait();

    await (
      await contract
        .connect(regulator)
        .addVerification("BATCH001", "Temperature Compliance", true, "Cold chain log reviewed")
    ).wait();

    const batch = await contract.getBatch("BATCH001");
    const custodyHistory = await contract.getCustodyHistory("BATCH001");
    const conditionHistory = await contract.getConditionHistory("BATCH001");
    const verificationHistory = await contract.getVerificationHistory("BATCH001");
    const recallInfo = await contract.getRecallInfo("BATCH001");

    expect(Number(batch.status)).to.equal(Status.Delivered);
    expect(batch.currentCustodian).to.equal(retailer.address);
    expect(batch.lastStatusNote).to.equal("Ready for dispensing");
    expect(custodyHistory.length).to.equal(2);
    expect(custodyHistory[0].from).to.equal(manufacturer.address);
    expect(custodyHistory[0].to).to.equal(distributor.address);
    expect(custodyHistory[1].from).to.equal(distributor.address);
    expect(custodyHistory[1].to).to.equal(retailer.address);
    expect(conditionHistory.length).to.equal(1);
    expect(conditionHistory[0].logHash).to.equal(logHash);
    expect(conditionHistory[0].breachFlag).to.equal(false);
    expect(verificationHistory.length).to.equal(1);
    expect(verificationHistory[0].verifiedBy).to.equal(regulator.address);
    expect(recallInfo.isRecalled).to.equal(false);
  });

  it("automatically flags a batch when a breach condition is anchored", async function () {
    const { contract, manufacturer, distributor } = await deployFixture();

    await moveToDistributor(contract, manufacturer, distributor, "BATCH002");

    await expect(
      contract
        .connect(distributor)
        .recordCondition(
          "BATCH002",
          ethers.keccak256(ethers.toUtf8Bytes("BATCH002-severe-log")),
          "backend/src/uploads/BATCH002-severe.json",
          true,
          "12 readings, max 11.2C, breach detected"
        )
    )
      .to.emit(contract, "StatusUpdated")
      .withArgs("BATCH002", Status.Flagged, "Condition breach detected");

    const batch = await contract.getBatch("BATCH002");
    expect(Number(batch.status)).to.equal(Status.Flagged);
    expect(batch.lastStatusNote).to.equal("Condition breach detected");
  });

  it("allows regulator recall and stores recall metadata", async function () {
    const { contract, manufacturer, distributor, regulator } = await deployFixture();

    await moveToDistributor(contract, manufacturer, distributor, "BATCH003");

    await expect(contract.connect(regulator).recallBatch("BATCH003", "Severe temperature excursion confirmed"))
      .to.emit(contract, "BatchRecalled")
      .withArgs("BATCH003", "Severe temperature excursion confirmed", regulator.address);

    const batch = await contract.getBatch("BATCH003");
    const recallInfo = await contract.getRecallInfo("BATCH003");

    expect(Number(batch.status)).to.equal(Status.Recalled);
    expect(batch.recalled).to.equal(true);
    expect(batch.lastStatusNote).to.equal("Severe temperature excursion confirmed");
    expect(recallInfo.isRecalled).to.equal(true);
    expect(recallInfo.reason).to.equal("Severe temperature excursion confirmed");
    expect(recallInfo.actionBy).to.equal(regulator.address);
  });

  it("rejects recall attempts by non-regulator operational roles", async function () {
    const { contract, manufacturer, distributor, retailer } = await deployFixture();

    await moveToDistributor(contract, manufacturer, distributor, "BATCH004");

    await expect(contract.connect(retailer).recallBatch("BATCH004", "Unauthorized recall")).to.be.revertedWith(
      "Only regulator or admin can recall"
    );
  });

  it("blocks transfers and status updates after recall", async function () {
    const { contract, manufacturer, distributor, retailer, regulator } = await deployFixture();

    await moveToDistributor(contract, manufacturer, distributor, "BATCH005");
    await (await contract.connect(regulator).recallBatch("BATCH005", "Recall during transit")).wait();

    await expect(
      contract.connect(distributor).transferCustody("BATCH005", retailer.address, "Tempe, AZ", "Attempted delivery")
    ).to.be.revertedWith("Batch has been recalled");

    await expect(
      contract.connect(distributor).updateStatus("BATCH005", Status.Received, "Attempted status")
    ).to.be.revertedWith("Batch has been recalled");
  });

  it("rejects invalid state transitions", async function () {
    const { contract, manufacturer } = await deployFixture();

    await registerBatch(contract, manufacturer, "BATCH006");

    await expect(
      contract.connect(manufacturer).updateStatus("BATCH006", Status.Delivered, "Skipping shipment")
    ).to.be.revertedWith("Invalid status transition");
  });

  it("rejects transfers from accounts that are not the current custodian or admin", async function () {
    const { contract, manufacturer, distributor, retailer } = await deployFixture();

    await registerBatch(contract, manufacturer, "BATCH007");

    await expect(
      contract.connect(distributor).transferCustody("BATCH007", retailer.address, "Tempe, AZ", "Wrong custodian")
    ).to.be.revertedWith("Only current custodian or admin can transfer");
  });

  it("rejects duplicate transfer to the same custodian", async function () {
    const { contract, manufacturer } = await deployFixture();

    await registerBatch(contract, manufacturer, "BATCH008");

    await expect(
      contract
        .connect(manufacturer)
        .transferCustody("BATCH008", manufacturer.address, "Phoenix, AZ", "No custody change")
    ).to.be.revertedWith("Recipient is already custodian");
  });

  it("rejects condition records from unauthorized roles", async function () {
    const { contract, manufacturer, distributor, consumer } = await deployFixture();

    await moveToDistributor(contract, manufacturer, distributor, "BATCH009");

    await expect(
      contract
        .connect(consumer)
        .recordCondition(
          "BATCH009",
          ethers.keccak256(ethers.toUtf8Bytes("consumer-log")),
          "backend/src/uploads/consumer.json",
          false,
          "Unauthorized log"
        )
    ).to.be.revertedWith("Only logistics custodian, regulator, or admin can record condition");
  });

  it("rejects regulator verification by non-regulator accounts", async function () {
    const { contract, manufacturer, distributor } = await deployFixture();

    await moveToDistributor(contract, manufacturer, distributor, "BATCH010");

    await expect(
      contract.connect(distributor).addVerification("BATCH010", "Compliance Review", true, "Looks valid")
    ).to.be.reverted;
  });

  it("handles unknown batch lookups and writes with clear reverts", async function () {
    const { contract, distributor } = await deployFixture();

    await expect(contract.getBatch("UNKNOWN")).to.be.revertedWith("Batch does not exist");

    await expect(
      contract
        .connect(distributor)
        .recordCondition(
          "UNKNOWN",
          ethers.keccak256(ethers.toUtf8Bytes("missing-log")),
          "backend/src/uploads/missing.json",
          false,
          "Missing batch"
        )
    ).to.be.revertedWith("Batch does not exist");
  });
});
