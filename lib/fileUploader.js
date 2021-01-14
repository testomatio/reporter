const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

const uploadUsingS3 = async (filePath, runId) => {
  const region = process.env.S3_REGION;
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

  const s3 = new AWS.S3({ region, accessKeyId, secretAccessKey });
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
      console.log('Uploading files');
      return uploadUsingS3(filePath, runId);
    }
    console.log('No/invalid upload option so skipping it');
  } catch (e) {
    console.log('Error occurred while uploading files', e);
  }
  return null;
};

module.exports = {
  uploadFile,
};
