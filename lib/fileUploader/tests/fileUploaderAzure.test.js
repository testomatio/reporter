const debug = require('debug')('@testomatio/reporter:file-uploader-azure');
const { BlobServiceClient } = require('@azure/storage-blob');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const chalk = require('chalk');
const memoize = require('lodash.memoize');

const keys = [
    'AZURE_STORAGE_CONNECTION_STRING',
    'AZURE_CONTAINER_NAME',
    'TESTOMATIO_DISABLE_ARTIFACTS',
    'TESTOMATIO_PRIVATE_ARTIFACTS',
];

// AZURE_STORAGE_CONNECTION_STRING = DefaultEndpointsProtocol=https;AccountName=testomatstore;AccountKey=lV1bogtH8khWuEpplIkHmqr4nA4LjgbO5OuiOdi8vQGAK++L3452U9AmrNLQF797awzoMzFTW2PF+ASt0E0dYw==;EndpointSuffix=core.windows.net
// AZURE_CONTAINER_NAME = mytestingtsm

let isEnabled;
  
let config;
  
function getConfig() {
    if (config) return config;
    config = keys.reduce((acc, key) => {
        acc[key] = process.env[key];
        return acc;
    }, {});
    debug('Azure Config', config);

    return config;
}

const isArtifactsEnabled = () => {
    if (isEnabled !== undefined) return isEnabled;
    const { AZURE_STORAGE_CONNECTION_STRING, TESTOMATIO_DISABLE_ARTIFACTS } = getConfig();
    isEnabled = !!(AZURE_STORAGE_CONNECTION_STRING && !TESTOMATIO_DISABLE_ARTIFACTS);
    debug(`Upload is ${isEnabled ? 'enabled' : 'disabled'}`);

    return isEnabled;
  };

const uploadUsingAzure = async (filePath, runId) => {
  let ContentType;
  let Key;

  if (typeof filePath === 'object') {
    ContentType = filePath.type;
    filePath = filePath.path;
    Key = filePath.name;
  }

  if (!fs.existsSync(filePath)) {
    console.error(chalk.yellow(`Artifacts file ${filePath} does not exist. Skipping...`));

    return;
  }
  // TODO: for testing
  // const {
  //   AZURE_STORAGE_CONNECTION_STRING,
  //   AZURE_CONTAINER_NAME
  // } = getConfig();

  const AZURE_STORAGE_CONNECTION_STRING = "DefaultEndpointsProtocol=https;AccountName=testomatstore;AccountKey=lV1bogtH8khWuEpplIkHmqr4nA4LjgbO5OuiOdi8vQGAK++L3452U9AmrNLQF797awzoMzFTW2PF+ASt0E0dYw==;EndpointSuffix=core.windows.net";
  const AZURE_CONTAINER_NAME = "mytestingtsm";

  const file = fs.readFileSync(filePath);

  Key = `${runId}/${uuidv4()}-${Key || path.basename(filePath)}`;

  const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);

  try {
    const containerClient = blobServiceClient.getContainerClient(AZURE_CONTAINER_NAME);
    const blockBlobClient = containerClient.getBlockBlobClient(Key);

    await blockBlobClient.upload(file, file.length, {
      'blobHTTPHeaders': {
        'blobContentType': ContentType
      }
    });

    const azureUploadedUrl = blockBlobClient.url;
    console.log('Uploaded:', azureUploadedUrl);
    // TODO: or response._response.request.url

    return azureUploadedUrl;
  } catch (e) {
    console.error(chalk.bold.red(`Failed uploading '${Key}'. Please check Azure Blob Storage credentials`), {
      connectionString: AZURE_STORAGE_CONNECTION_STRING,
      container: AZURE_CONTAINER_NAME,
    });

    console.log('---------------');
  }
};

const uploadFileByPath = async (filePath, runId) => {
    try {
      if (isArtifactsEnabled()) {
        return await uploadUsingAzure(filePath, runId);
      }
    } catch (e) {
      console.error(chalk.red('Error occurred while uploading artifacts'), e);
    }
};

const filepath = '/home/vitalii/tomato-testreporter/reporter/lib/test-2.pdf';

uploadUsingAzure(filepath, 'test12345@1')
  .then(() => console.log("End"))
  .catch((ex) => console.log(ex.message));

  // TODO:
// module.exports = {
//     uploadFileByPath: memoize(uploadFileByPath),
//     isArtifactsEnabled: memoize(isArtifactsEnabled),
// };