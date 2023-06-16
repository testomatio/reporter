const debug = require('debug')('@testomatio/reporter:file-uploader');
const { S3 } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { randomUUID } = require('crypto');
const memoize = require('lodash.memoize');
const { APP_PREFIX } = require('./constants');

const keys = [
  'S3_ENDPOINT',
  'S3_REGION',
  'S3_BUCKET',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'TESTOMATIO_DISABLE_ARTIFACTS',
  'TESTOMATIO_PRIVATE_ARTIFACTS',
  'S3_FORCE_PATH_STYLE',
];

let config;

function resetConfig() {
  config = undefined;
  isEnabled = undefined;
}

function getConfig() {
  if (config) return config;
  config = keys.reduce((acc, key) => {
    acc[key] = process.env[key];
    return acc;
  }, {});
  return config;
}

function getMaskedConfig() {
  return Object.fromEntries(Object.entries(getConfig())
    .map(([key, value]) => [key, key === 'S3_SECRET_ACCESS_KEY' || key === 'S3_ACCESS_KEY_ID' ? '***' : value]));
}

let isEnabled;

const isArtifactsEnabled = () => {
  if (isEnabled !== undefined) return isEnabled;
  const { S3_BUCKET, TESTOMATIO_DISABLE_ARTIFACTS } = getConfig();
  isEnabled = !!(S3_BUCKET && !TESTOMATIO_DISABLE_ARTIFACTS);
  debug(`Upload is ${isEnabled ? 'enabled' : 'disabled'}`);
  return isEnabled;
};

const _getFileExtBase64 = str => {
  const type = str.charAt(0);

  return (
    {
      '/': '.jpg',
      i: '.png',
      R: '.gif',
      U: '.webp',
    }[type] || ''
  );
};

const _getS3Config = () => {
  const { S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_FORCE_PATH_STYLE, S3_ENDPOINT } = getConfig();

  const cfg = {
    region: S3_REGION,
    credentials: {
      accessKeyId: S3_ACCESS_KEY_ID,
      secretAccessKey: S3_SECRET_ACCESS_KEY,
      s3ForcePathStyle: S3_FORCE_PATH_STYLE,
    }
  };

  if (S3_ENDPOINT) {
    cfg.endpoint = S3_ENDPOINT;
  }

  return cfg;
}

const uploadUsingS3 = async (filePath, runId) => {
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

  const {
    TESTOMATIO_PRIVATE_ARTIFACTS, S3_BUCKET
  } = getConfig();

  debug('S3 config', getMaskedConfig());
  debug('Uploading', filePath, 'to', S3_BUCKET);
  
const fileData = fs.readFileSync(filePath);

  Key = `${runId}/${randomUUID()}-${Key || path.basename(filePath)}`;
  const ACL = TESTOMATIO_PRIVATE_ARTIFACTS ? 'private' : 'public-read';

  const s3 = new S3(_getS3Config());

  const params = {
    Bucket: S3_BUCKET,
    Key,
    Body: fileData,
    ContentType,
    ACL,
  };

  try {
    const out = new Upload({
      client: s3,
      params
    });

    await out.done();
    debug('Uploaded', out.singleUploadResult.Location)

    return out.singleUploadResult.Location;
  } catch (e) {
    console.log(e);
    console.log(APP_PREFIX, chalk.red(`Failed uploading '${Key}'. Please check S3 credentials`), getMaskedConfig());

    console.log(APP_PREFIX, `To ${chalk.bold('disable')} artifact uploads set: TESTOMATIO_DISABLE_ARTIFACTS=1`);
    if (!TESTOMATIO_PRIVATE_ARTIFACTS) {
      console.log(APP_PREFIX, `To enable ${chalk.bold('PRIVATE')} uploads set: TESTOMATIO_PRIVATE_ARTIFACTS=1`);
    } else {
      console.log(
        APP_PREFIX,
        `To enable ${chalk.bold('PUBLIC')} uploads remove TESTOMATIO_PRIVATE_ARTIFACTS env variable`,
      );
    }
    console.log(APP_PREFIX, '---------------');
  } 
};

const uploadUsingS3AsBuffer = async (buffer, fileName, runId) => {

  const {
    S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_ENDPOINT, TESTOMATIO_PRIVATE_ARTIFACTS, S3_BUCKET
  } = getConfig();

  const ACL = TESTOMATIO_PRIVATE_ARTIFACTS ? 'private' : 'public-read';

  const fileExtension = _getFileExtBase64(buffer.toString('base64'));
  const Key = `${runId}/${fileName}${fileExtension}`;

  const s3 = new S3(_getS3Config());

  try {
    const out = new Upload({
      client: s3,

      params: {
        Bucket: S3_BUCKET,
        Key,
        Body: buffer,
        ACL,
      }
    });
    await out.done();

    return out.singleUploadResult.Location;
  } catch (e) {
    console.log(APP_PREFIX, chalk.bold.red(`Failed uploading '${Key}'. Please check S3 credentials`), {
      accessKeyId: S3_ACCESS_KEY_ID,
      secretAccessKey: S3_SECRET_ACCESS_KEY ? '**** (hidden) ***' : '(empty)',
      region: S3_REGION,
      bucket: S3_BUCKET,
      acl: ACL,
      endpoint: S3_ENDPOINT,
    });

    console.log(APP_PREFIX, `To ${chalk.bold('disable')} artifact uploads set: TESTOMATIO_DISABLE_ARTIFACTS=1`);
    if (!TESTOMATIO_PRIVATE_ARTIFACTS) {
      console.log(APP_PREFIX, `To enable ${chalk.bold('PRIVATE')} uploads set: TESTOMATIO_PRIVATE_ARTIFACTS=1`);
    } else {
      console.log(
        APP_PREFIX,
        `To enable ${chalk.bold('PUBLIC')} uploads remove TESTOMATIO_PRIVATE_ARTIFACTS env variable`,
      );
    }
    console.log(APP_PREFIX, '---------------');
  }
};

const uploadFileByPath = async (filePath, runId) => {
  try {
    if (isArtifactsEnabled()) {
      return uploadUsingS3(filePath, runId);
    }
  } catch (e) {
    console.error(chalk.red('Error occurred while uploading artifacts'), e);
  }
};

const uploadFileAsBuffer = async (buffer, fileName, runId) => {
  try {
    if (isArtifactsEnabled()) {
      return uploadUsingS3AsBuffer(buffer, fileName, runId);
    }
  } catch (e) {
    console.error(chalk.red('Error occurred while uploading artifacts'), e);
  }
};

module.exports = {
  uploadFileByPath: memoize(uploadFileByPath),
  uploadFileAsBuffer: memoize(uploadFileAsBuffer),
  isArtifactsEnabled,
  resetConfig,
};
