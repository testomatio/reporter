const chalk = require('chalk');
const os = require('os');
const path = require('path');

const APP_PREFIX = chalk.gray('[TESTOMATIO]');
const AXIOS_TIMEOUT = 20 * 1000; // sum = 20sec
const AXIOS_RETRY_TIMEOUT = 5 * 1000; // sum = 5sec

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
// html pipe var
const HTML_REPORT = {
  FOLDER: 'html-report',
  REPORT_DEFAULT_NAME: 'testomatio-report.html',
  TEMPLATE_NAME: 'testomatio.hbs',
};

const testomatLogoURL = 'https://avatars.githubusercontent.com/u/59105116?s=36&v=4';

const REPORTER_REQUEST_RETRIES = {
  maxAmount: Number(process.env.TESTOMAT_MAX_REQUEST_RETRIES_COUNT) || 6,
  withinTimeSeconds: Number(process.env.TESTOMAT_MAX_REQUEST_RETRIES_WITHIN_TIME_SECONDS) || 60,
}

module.exports = {
  APP_PREFIX,
  TESTOMAT_TMP_STORAGE_DIR,
  CSV_HEADERS,
  STATUS,
  HTML_REPORT,
  AXIOS_TIMEOUT,
  AXIOS_RETRY_TIMEOUT,
  testomatLogoURL,
  REPORTER_REQUEST_RETRIES,
};
