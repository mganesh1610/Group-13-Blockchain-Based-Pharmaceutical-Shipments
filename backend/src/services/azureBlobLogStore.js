const { BlobServiceClient } = require("@azure/storage-blob");
const { azureBlob } = require("../config");

let containerClientPromise = null;

function isEnabled() {
  return azureBlob.enabled;
}

async function getContainerClient() {
  if (!isEnabled()) {
    throw new Error("Azure Blob Storage is not configured");
  }

  if (!containerClientPromise) {
    const blobServiceClient = BlobServiceClient.fromConnectionString(azureBlob.connectionString);
    const containerClient = blobServiceClient.getContainerClient(azureBlob.containerName);
    containerClientPromise = containerClient.createIfNotExists().then(() => containerClient);
  }

  return containerClientPromise;
}

async function ensureContainer() {
  if (!isEnabled()) {
    return;
  }

  await getContainerClient();
}

async function uploadLogFile(filename, buffer, contentType) {
  const containerClient = await getContainerClient();
  const blobClient = containerClient.getBlockBlobClient(filename);

  await blobClient.uploadData(buffer, {
    blobHTTPHeaders: {
      blobContentType: contentType || "application/octet-stream"
    }
  });

  return {
    blobName: filename,
    blobUrl: blobClient.url
  };
}

async function readLogFile(filename) {
  const containerClient = await getContainerClient();
  const blobClient = containerClient.getBlockBlobClient(filename);

  if (!(await blobClient.exists())) {
    const error = new Error("Log file not found");
    error.statusCode = 404;
    throw error;
  }

  const properties = await blobClient.getProperties();
  const buffer = await blobClient.downloadToBuffer();

  return {
    filename,
    buffer,
    contentType: properties.contentType || "application/octet-stream"
  };
}

module.exports = {
  isEnabled,
  ensureContainer,
  uploadLogFile,
  readLogFile
};
