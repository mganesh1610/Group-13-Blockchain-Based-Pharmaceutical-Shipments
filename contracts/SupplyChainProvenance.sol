// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title SupplyChainProvenance
 * @notice Tracks the lifecycle of pharmaceutical batches across manufacturer,
 * distributor, retailer, and regulator interactions.
 */
contract SupplyChainProvenance is AccessControl {
    bytes32 public constant MANUFACTURER_ROLE = keccak256("MANUFACTURER_ROLE");
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");
    bytes32 public constant RETAILER_ROLE = keccak256("RETAILER_ROLE");
    bytes32 public constant REGULATOR_ROLE = keccak256("REGULATOR_ROLE");

    enum Status {
        Created,
        Shipped,
        Received,
        Stored,
        Delivered,
        Flagged
    }

    struct ProductBatch {
        string batchId;
        string productName;
        string origin;
        uint256 manufactureDate;
        address manufacturer;
        address currentCustodian;
        Status status;
        bool exists;
    }

    struct CustodyRecord {
        address from;
        address to;
        uint256 timestamp;
        string location;
        string notes;
    }

    struct ConditionRecord {
        bytes32 logHash;
        string logURI;
        bool breachFlag;
        string summary;
        uint256 timestamp;
        address submittedBy;
    }

    struct VerificationRecord {
        string verificationType;
        bool result;
        string remarks;
        uint256 timestamp;
        address verifiedBy;
    }

    mapping(string => ProductBatch) private batches;
    mapping(string => CustodyRecord[]) private batchCustodyHistory;
    mapping(string => ConditionRecord[]) private batchConditionHistory;
    mapping(string => VerificationRecord[]) private batchVerificationHistory;

    string[] private batchIndex;

    event BatchRegistered(string batchId, address manufacturer);
    event CustodyTransferred(string batchId, address from, address to, string location);
    event StatusUpdated(string batchId, uint8 newStatus, string notes);
    event ConditionRecorded(string batchId, bytes32 logHash, bool breachFlag, string logURI);
    event VerificationAdded(string batchId, string verificationType, bool result, address verifiedBy);

    constructor(address admin) {
        require(admin != address(0), "Admin address required");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /**
     * @notice Registers a new batch and makes the manufacturer the first custodian.
     */
    function registerBatch(
        string memory batchId,
        string memory productName,
        string memory origin,
        uint256 manufactureDate
    ) external onlyRole(MANUFACTURER_ROLE) {
        require(bytes(batchId).length > 0, "Batch ID is required");
        require(bytes(productName).length > 0, "Product name is required");
        require(bytes(origin).length > 0, "Origin is required");
        require(!batches[batchId].exists, "Batch already registered");

        batches[batchId] = ProductBatch({
            batchId: batchId,
            productName: productName,
            origin: origin,
            manufactureDate: manufactureDate,
            manufacturer: msg.sender,
            currentCustodian: msg.sender,
            status: Status.Created,
            exists: true
        });

        batchIndex.push(batchId);

        emit BatchRegistered(batchId, msg.sender);
        emit StatusUpdated(batchId, uint8(Status.Created), "Batch created");
    }

    /**
     * @notice Transfers custody of a batch to the next approved stakeholder.
     */
    function transferCustody(
        string memory batchId,
        address to,
        string memory location,
        string memory notes
    ) external {
        _requireBatchExists(batchId);
        require(to != address(0), "Recipient address is required");
        require(_isOperationalSender(batchId, msg.sender), "Only current custodian or admin can transfer");
        require(_isStakeholder(to), "Recipient must have a supply chain role");

        ProductBatch storage batch = batches[batchId];
        address previousCustodian = batch.currentCustodian;
        batch.currentCustodian = to;

        batchCustodyHistory[batchId].push(
            CustodyRecord({
                from: previousCustodian,
                to: to,
                timestamp: block.timestamp,
                location: location,
                notes: notes
            })
        );

        emit CustodyTransferred(batchId, previousCustodian, to, location);
    }

    /**
     * @notice Updates the current lifecycle status for a batch.
     */
    function updateStatus(
        string memory batchId,
        uint8 newStatus,
        string memory notes
    ) external {
        _requireBatchExists(batchId);
        require(_isOperationalSender(batchId, msg.sender), "Only current custodian or admin can update status");
        require(newStatus <= uint8(Status.Flagged), "Invalid status value");

        batches[batchId].status = Status(newStatus);

        emit StatusUpdated(batchId, newStatus, notes);
    }

    /**
     * @notice Anchors the digest and URI for an off-chain IoT condition log.
     */
    function recordCondition(
        string memory batchId,
        bytes32 logHash,
        string memory logURI,
        bool breachFlag,
        string memory summary
    ) external {
        _requireBatchExists(batchId);
        require(_isOperationalSender(batchId, msg.sender), "Only current custodian or admin can record condition");
        require(logHash != bytes32(0), "Log hash is required");
        require(bytes(logURI).length > 0, "Log URI is required");

        batchConditionHistory[batchId].push(
            ConditionRecord({
                logHash: logHash,
                logURI: logURI,
                breachFlag: breachFlag,
                summary: summary,
                timestamp: block.timestamp,
                submittedBy: msg.sender
            })
        );

        if (breachFlag) {
            batches[batchId].status = Status.Flagged;
            emit StatusUpdated(batchId, uint8(Status.Flagged), "Condition breach detected");
        }

        emit ConditionRecorded(batchId, logHash, breachFlag, logURI);
    }

    /**
     * @notice Adds a regulator verification or compliance decision for a batch.
     */
    function addVerification(
        string memory batchId,
        string memory verificationType,
        bool result,
        string memory remarks
    ) external onlyRole(REGULATOR_ROLE) {
        _requireBatchExists(batchId);
        require(bytes(verificationType).length > 0, "Verification type is required");

        batchVerificationHistory[batchId].push(
            VerificationRecord({
                verificationType: verificationType,
                result: result,
                remarks: remarks,
                timestamp: block.timestamp,
                verifiedBy: msg.sender
            })
        );

        emit VerificationAdded(batchId, verificationType, result, msg.sender);
    }

    function getBatch(string memory batchId) external view returns (ProductBatch memory) {
        _requireBatchExists(batchId);
        return batches[batchId];
    }

    function getCustodyHistory(string memory batchId) external view returns (CustodyRecord[] memory) {
        _requireBatchExists(batchId);
        return batchCustodyHistory[batchId];
    }

    function getConditionHistory(string memory batchId) external view returns (ConditionRecord[] memory) {
        _requireBatchExists(batchId);
        return batchConditionHistory[batchId];
    }

    function getVerificationHistory(string memory batchId) external view returns (VerificationRecord[] memory) {
        _requireBatchExists(batchId);
        return batchVerificationHistory[batchId];
    }

    function getBatchCount() external view returns (uint256) {
        return batchIndex.length;
    }

    function getAllBatchIds() external view returns (string[] memory) {
        return batchIndex;
    }

    function batchExists(string memory batchId) external view returns (bool) {
        return batches[batchId].exists;
    }

    function _requireBatchExists(string memory batchId) internal view {
        require(batches[batchId].exists, "Batch does not exist");
    }

    function _isOperationalSender(string memory batchId, address account) internal view returns (bool) {
        return account == batches[batchId].currentCustodian || hasRole(DEFAULT_ADMIN_ROLE, account);
    }

    function _isStakeholder(address account) internal view returns (bool) {
        return
            hasRole(MANUFACTURER_ROLE, account) ||
            hasRole(DISTRIBUTOR_ROLE, account) ||
            hasRole(RETAILER_ROLE, account) ||
            hasRole(REGULATOR_ROLE, account) ||
            hasRole(DEFAULT_ADMIN_ROLE, account);
    }
}
