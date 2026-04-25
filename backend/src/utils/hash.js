const fs = require("fs/promises");
const { keccak256 } = require("ethers");

function hashBuffer(buffer) {
  return keccak256(Uint8Array.from(buffer));
}

async function hashFile(filePath) {
  const buffer = await fs.readFile(filePath);
  return hashBuffer(buffer);
}

module.exports = {
  hashBuffer,
  hashFile
};
