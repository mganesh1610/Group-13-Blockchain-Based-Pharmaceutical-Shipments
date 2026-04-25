// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title SupplyChainProvenance
 * @notice Tracks pharmaceutical cold-chain custody, condition proofs, and
 * regulator decisions. Raw IoT files stay off-chain; this contract stores
 * compact hashes, lifecycle state, and complete audit history.
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
        Flagged,
        Recalled
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
        bool recalled;
        string lastStatusNote;
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

    struct RecallRecord {
        bool isRecalled;
        string reason;
        uint256 timestamp;
        address actionBy;
    }

    mapping(string => ProductBatch) private batches;
    mapping(string => CustodyRecord[]) private batchCustodyHistory;
    mapping(string => ConditionRecord[]) private batchConditionHistory;
    mapping(string => VerificationRecord[]) private batchVerificationHistory;
    mapping(string => RecallRecord) private batchRecallInfo;

    string[] private batchIndex;

    event BatchRegistered(string batchId, address manufacturer);
    event CustodyTransferred(string batchId, address from, address to, string location);
    event StatusUpdated(string batchId, uint8 newStatus, string notes);
    event ConditionRecorded(string batchId, bytes32 logHash, bool breachFlag, string logURI);
    event VerificationAdded(string batchId, string verificationType, bool result, address verifiedBy);
    event BatchRecalled(string batchId, string reason, address actionBy);

    constructor(address admin) {
        require(admin != address(0), "Admin address required");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /**
     * @notice Registers a new pharmaceutical batch and sets the manufacturer as
     * the first custodian.
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
            exists: true,
            recalled: false,
            lastStatusNote: "Batch created"
        });

        batchIndex.push(batchId);

        emit BatchRegistered(batchId, msg.sender);
        emit StatusUpdated(batchId, uint8(Status.Created), "Batch created");
    }

    /**
     * @notice Transfers custody to another approved supply-chain stakeholder.
     */
    function transferCustody(
        string memory batchId,
        address to,
        string memory location,
        string memory notes
    ) external {
        _requireActiveBatch(batchId);
        require(to != address(0), "Recipient address is required");
        require(_isOperationalSender(batchId, msg.sender), "Only current custodian or admin can transfer");
        require(_isStakeholder(to), "Recipient must have a supply chain role");
        require(to != batches[batchId].currentCustodian, "Recipient is already custodian");

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
     * @notice Updates lifecycle state. Recall transitions are intentionally
     * restricted to recallBatch().
     */
    function updateStatus(
        string memory batchId,
        uint8 newStatus,
        string memory notes
    ) external {
        _requireActiveBatch(batchId);
        require(_isOperationalSender(batchId, msg.sender), "Only current custodian or admin can update status");
        require(newStatus <= uint8(Status.Flagged), "Invalid status value");

        ProductBatch storage batch = batches[batchId];
        Status targetStatus = Status(newStatus);
        require(_isValidTransition(batch.status, targetStatus), "Invalid status transition");

        batch.status = targetStatus;
        batch.lastStatusNote = notes;

        emit StatusUpdated(batchId, newStatus, notes);
    }

    /**
     * @notice Anchors the digest and URI for an off-chain IoT condition log.
     * Distributor/retailer custodians record normal logistics logs; regulators
     * and admins can record review logs.
     */
    function recordCondition(
        string memory batchId,
        bytes32 logHash,
        string memory logURI,
        bool breachFlag,
        string memory summary
    ) external {
        _requireActiveBatch(batchId);
        require(
            _canRecordCondition(batchId, msg.sender),
            "Only logistics custodian, regulator, or admin can record condition"
        );
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

        if (breachFlag && batches[batchId].status != Status.Flagged) {
            batches[batchId].status = Status.Flagged;
            batches[batchId].lastStatusNote = "Condition breach detected";
            emit StatusUpdated(batchId, uint8(Status.Flagged), "Condition breach detected");
        }

        emit ConditionRecorded(batchId, logHash, breachFlag, logURI);
    }

    /**
     * @notice Adds a regulator verification, approval, rejection, or inspection
     * decision for the batch.
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

    /**
     * @notice Marks a batch recalled. Only the regulator or admin can execute
     * this exception-handling action.
     */
    function recallBatch(string memory batchId, string memory reason) external {
        _requireBatchExists(batchId);
        require(_isAdminOrRegulator(msg.sender), "Only regulator or admin can recall");
        require(bytes(reason).length > 0, "Recall reason is required");
        require(!batches[batchId].recalled, "Batch already recalled");

        ProductBatch storage batch = batches[batchId];
        batch.recalled = true;
        batch.status = Status.Recalled;
        batch.lastStatusNote = reason;

        batchRecallInfo[batchId] = RecallRecord({
            isRecalled: true,
            reason: reason,
            timestamp: block.timestamp,
            actionBy: msg.sender
        });

        emit StatusUpdated(batchId, uint8(Status.Recalled), reason);
        emit BatchRecalled(batchId, reason, msg.sender);
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

    function getRecallInfo(string memory batchId) external view returns (RecallRecord memory) {
        _requireBatchExists(batchId);
        return batchRecallInfo[batchId];
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

    function _requireActiveBatch(string memory batchId) internal view {
        _requireBatchExists(batchId);
        require(!batches[batchId].recalled, "Batch has been recalled");
    }

    function _isOperationalSender(string memory batchId, address account) internal view returns (bool) {
        return account == batches[batchId].currentCustodian || hasRole(DEFAULT_ADMIN_ROLE, account);
    }

    function _isAdminOrRegulator(address account) internal view returns (bool) {
        return hasRole(DEFAULT_ADMIN_ROLE, account) || hasRole(REGULATOR_ROLE, account);
    }

    function _canRecordCondition(string memory batchId, address account) internal view returns (bool) {
        if (_isAdminOrRegulator(account)) {
            return true;
        }

        bool isLogisticsRole = hasRole(DISTRIBUTOR_ROLE, account) || hasRole(RETAILER_ROLE, account);
        return isLogisticsRole && account == batches[batchId].currentCustodian;
    }

    function _isStakeholder(address account) internal view returns (bool) {
        return
            hasRole(MANUFACTURER_ROLE, account) ||
            hasRole(DISTRIBUTOR_ROLE, account) ||
            hasRole(RETAILER_ROLE, account) ||
            hasRole(REGULATOR_ROLE, account) ||
            hasRole(DEFAULT_ADMIN_ROLE, account);
    }

    function _isValidTransition(Status currentStatus, Status nextStatus) internal pure returns (bool) {
        if (currentStatus == nextStatus || nextStatus == Status.Recalled) {
            return false;
        }

        if (currentStatus == Status.Created) {
            return nextStatus == Status.Shipped || nextStatus == Status.Stored || nextStatus == Status.Flagged;
        }

        if (currentStatus == Status.Shipped) {
            return nextStatus == Status.Received || nextStatus == Status.Flagged;
        }

        if (currentStatus == Status.Received) {
            return nextStatus == Status.Stored || nextStatus == Status.Delivered || nextStatus == Status.Flagged;
        }

        if (currentStatus == Status.Stored) {
            return nextStatus == Status.Shipped || nextStatus == Status.Delivered || nextStatus == Status.Flagged;
        }

        if (currentStatus == Status.Delivered) {
            return nextStatus == Status.Flagged;
        }

        if (currentStatus == Status.Flagged) {
            return nextStatus == Status.Stored || nextStatus == Status.Delivered;
        }

        return false;
    }
}
