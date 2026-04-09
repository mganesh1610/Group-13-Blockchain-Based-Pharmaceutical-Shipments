export const supplyChainAbi = [
  "function MANUFACTURER_ROLE() view returns (bytes32)",
  "function DISTRIBUTOR_ROLE() view returns (bytes32)",
  "function RETAILER_ROLE() view returns (bytes32)",
  "function REGULATOR_ROLE() view returns (bytes32)",
  "function grantRole(bytes32 role, address account)",
  "function registerBatch(string batchId, string productName, string origin, uint256 manufactureDate)",
  "function transferCustody(string batchId, address to, string location, string notes)",
  "function updateStatus(string batchId, uint8 newStatus, string notes)",
  "function recordCondition(string batchId, bytes32 logHash, string logURI, bool breachFlag, string summary)",
  "function addVerification(string batchId, string verificationType, bool result, string remarks)",
  "function getBatch(string batchId) view returns ((string batchId, string productName, string origin, uint256 manufactureDate, address manufacturer, address currentCustodian, uint8 status, bool exists))",
  "function getCustodyHistory(string batchId) view returns ((address from, address to, uint256 timestamp, string location, string notes)[])",
  "function getConditionHistory(string batchId) view returns ((bytes32 logHash, string logURI, bool breachFlag, string summary, uint256 timestamp, address submittedBy)[])",
  "function getVerificationHistory(string batchId) view returns ((string verificationType, bool result, string remarks, uint256 timestamp, address verifiedBy)[])",
  "function getAllBatchIds() view returns (string[])"
];

export const statusLabels = ["Created", "Shipped", "Received", "Stored", "Delivered", "Flagged"];
