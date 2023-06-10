const chalk = require('chalk');

const APP_PREFIX = chalk.gray('[TESTOMATIO]');
const TESTOMAT_ARTIFACT_SUFFIX = "testomatio_artifact_";
const TESTOMAT_TMP_FOLDER_PREFIX = "tsmt_reporter";

const CSV_HEADERS = [
  { id: 'suite_title', title: 'Suite_title' },
  { id: 'title', title: 'Title' },
  { id: 'status', title: 'Status' },
  { id: 'message', title: 'Message' },
  { id: 'stack', title: 'Stack' },
];

const STATUS = {
  PASSED: 'passed',
  FAILED: 'failed',
  SKIPPED: 'skipped',
  FINISHED: 'finished',
};

const UPLOAD_AZURE_KEYS = [
  'AZURE_DEFAULT_ENDPOINTS_PROTOCOL',
  'AZURE_ACCOUNT_NAME',
  'AZURE_ACCOUNT_KEY',
  'AZURE_ENDPOINT_SUFFIX',
  'AZURE_CONTAINER_NAME',
  'TESTOMATIO_DISABLE_ARTIFACTS',
  'TESTOMATIO_PRIVATE_ARTIFACTS'
];

const UPLOAD_S3_KEYS = [
  'S3_ENDPOINT',
  'S3_REGION',
  'S3_BUCKET',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'S3_FORCE_PATH_STYLE',
  'TESTOMATIO_DISABLE_ARTIFACTS',
  'TESTOMATIO_PRIVATE_ARTIFACTS'
]

module.exports = {
  APP_PREFIX,
  TESTOMAT_ARTIFACT_SUFFIX,
  TESTOMAT_TMP_FOLDER_PREFIX,
  CSV_HEADERS,
  STATUS,
  UPLOAD_AZURE_KEYS,
  UPLOAD_S3_KEYS
}