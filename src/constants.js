import pc from 'picocolors';
import os from 'os';
import path from 'path';
import { transformEnvVarToBoolean } from './utils/utils.js';

const APP_PREFIX = pc.gray('[TESTOMATIO]');
const TESTOMATIO_REQUEST_TIMEOUT = parseInt(process.env.TESTOMATIO_REQUEST_TIMEOUT, 10);
if (TESTOMATIO_REQUEST_TIMEOUT) {
  console.log(`${APP_PREFIX} Request timeout is set to ${TESTOMATIO_REQUEST_TIMEOUT / 1000}s`);
}
const REQUEST_TIMEOUT = TESTOMATIO_REQUEST_TIMEOUT || 20 * 1000;
const SCREENSHOTS_ON_STEPS = process.env.TESTOMATIO_SCREENSHOTS_ON_STEPS == null
  || transformEnvVarToBoolean(process.env.TESTOMATIO_SCREENSHOTS_ON_STEPS);

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

// batch upload mode
/** @type {{ AUTO: 'auto', MANUAL: 'manual', DISABLED: 'disabled' }} */
const BATCH_MODE = {
  AUTO: 'auto',
  MANUAL: 'manual',
  DISABLED: 'disabled',
};
// html pipe var
const HTML_REPORT = {
  FOLDER: 'html-report',
  REPORT_DEFAULT_NAME: 'testomatio-report.html',
  TEMPLATE_NAME: 'testomatio.hbs',
};

// markdown pipe var
const MARKDOWN_REPORT = {
  FOLDER: 'md-report',
  REPORT_DEFAULT_NAME: 'testomatio-report.md',
};

const testomatLogoURL = 'https://avatars.githubusercontent.com/u/59105116?s=36&v=4';

const REPORTER_REQUEST_RETRIES = {
  retryTimeout: 5 * 1000, // sum = 5sec
  retriesPerRequest: 2,
  maxTotalRetries: Number(process.env.TESTOMATIO_MAX_REQUEST_FAILURES_COUNT) || 10,
  withinTimeSeconds: Number(process.env.TESTOMATIO_MAX_REQUEST_RETRIES_WITHIN_TIME_SECONDS) || 60,
};

const DEBUG_FILE = 'testomatio.debug';

function getCreateRunRequestTimeout() {
  return Math.max(REQUEST_TIMEOUT, 80 * 1000);
}

export {
  APP_PREFIX,
  TESTOMAT_TMP_STORAGE_DIR,
  CSV_HEADERS,
  STATUS,
  BATCH_MODE,
  HTML_REPORT,
  MARKDOWN_REPORT,
  REQUEST_TIMEOUT,
  getCreateRunRequestTimeout,
  testomatLogoURL,
  REPORTER_REQUEST_RETRIES,
  SCREENSHOTS_ON_STEPS,
  DEBUG_FILE,
};
