const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

const uploadUsingS3 = async (filePath, runId) => {
  const region = process.env.S3_REGION;
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

  const config = { region, accessKeyId, secretAccessKey };
  if (process.env.S3_ENDPOINT) {
    config.endpoint = new AWS.Endpoint(process.env.S3_ENDPOINT);
  }

  const s3 = new AWS.S3(config);
  const file = fs.readFileSync(filePath);
  const fileName = `${runId}/${path.basename(filePath)}`;
  const out = await s3.upload({
    Bucket: bucket, Key: fileName, Body: file, ACL: 'public-read',
  }).promise();
  return out.Location;
};

const uploadFile = async (filePath, runId) => {
  try {
    if (process.env.S3_BUCKET) {
      return uploadUsingS3(filePath, runId);
    }
  } catch (e) {
    console.error(chalk.red('Error occurred while uploading artifacts'), e);
  }
  return null;
};

module.exports = {
  uploadFile,
};
