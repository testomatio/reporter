const chalk = require('chalk');
const os = require('os');
const path = require('path');

const APP_PREFIX = chalk.gray('[TESTOMATIO]');

const TESTOMAT_TMP_STORAGE_DIR = path.join(os.tmpdir(), 'testomatio_tmp');

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
  TESTOMAT_TMP_STORAGE_DIR,
  CSV_HEADERS,
  STATUS,
}