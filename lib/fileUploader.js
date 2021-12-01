const AWS = require("aws-sdk");
const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const { APP_PREFIX } = require("./constants");

const isPrivate = process.env.TESTOMATIO_PRIVATE_ARTIFACTS;

function isEnabled() {
  return process.env.S3_BUCKET && !process.env.TESTOMATIO_DISABLE_ARTIFACTS;
}

const uploadUsingS3 = async (filePath, runId) => {
  const region = process.env.S3_REGION;
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const isDisabled = process.env.TESTOMATIO_DISABLE_ARTIFACTS;

  if (isDisabled) return;

  let contentType;
  let fileName;

  if (typeof filePath === 'object') {
    contentType = filePath.type;
    filePath = filePath.path;
    fileName = filePath.name;
  }

  const config = { region, accessKeyId, secretAccessKey };
  if (process.env.S3_ENDPOINT) {
    config.endpoint = new AWS.Endpoint(process.env.S3_ENDPOINT);
  }

  const s3 = new AWS.S3(config);
  const file = fs.readFileSync(filePath);

  fileName = `${runId}/${fileName || path.basename(filePath)}`;
  const acl = isPrivate ? "private" : "public-read"

  try {
    const out = await s3
      .upload({
        Bucket: bucket,
        Key: fileName,
        Body: file,
        ContentType: contentType,
        ACL: acl,
      })
      .promise();
    return out.Location;
  } catch (e) {
    console.log(APP_PREFIX, chalk.bold.red(`Failed uploading '${fileName}'. Please check S3 credentials`), {
      accessKeyId,
      secretAccessKey: secretAccessKey ? '**** (hidden) ***' : '(empty)',
      region,
      bucket,
      acl,
      endpoint: process.env.S3_ENDPOINT
    })

    console.log(APP_PREFIX, `To ${chalk.bold('disable')} artifact uploads set: TESTOMATIO_DISABLE_ARTIFACTS=1`)
    if (!isPrivate) {
      console.log(APP_PREFIX, `To enable ${chalk.bold('PRIVATE')} uploads set: TESTOMATIO_PRIVATE_ARTIFACTS=1`)
    } else {
      console.log(APP_PREFIX, `To enable ${chalk.bold('PUBLIC')} uploads remove TESTOMATIO_PRIVATE_ARTIFACTS env variable`)
    }
    console.log(APP_PREFIX, '---------------')
    return null;
  }
};

const uploadFile = async (filePath, runId) => {
  try {
    if (isEnabled()) {
      return uploadUsingS3(filePath, runId);
    }
  } catch (e) {
    console.error(chalk.red("Error occurred while uploading artifacts"), e);
  }
  return null;
};

module.exports = {
  uploadFile,
  isPrivate,
  isEnabled,
};
