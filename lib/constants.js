const chalk = require('chalk');

const APP_PREFIX = chalk.gray('[TESTOMATIO]');
const TESTOMAT_ARTIFACT_SUFFIX = "testomatio_artifact_";

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

module.exports = {
  APP_PREFIX,
  TESTOMAT_ARTIFACT_SUFFIX,
  CSV_HEADERS,
  STATUS,
}