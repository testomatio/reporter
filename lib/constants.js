"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.REPORTER_REQUEST_RETRIES = exports.testomatLogoURL = exports.AXIOS_TIMEOUT = exports.HTML_REPORT = exports.STATUS = exports.CSV_HEADERS = exports.TESTOMAT_TMP_STORAGE_DIR = exports.APP_PREFIX = void 0;
const picocolors_1 = __importDefault(require("picocolors"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const APP_PREFIX = picocolors_1.default.gray('[TESTOMATIO]');
exports.APP_PREFIX = APP_PREFIX;
const TESTOMATIO_REQUEST_TIMEOUT = parseInt(process.env.TESTOMATIO_REQUEST_TIMEOUT, 10);
if (TESTOMATIO_REQUEST_TIMEOUT) {
    console.log(`${APP_PREFIX} Request timeout is set to ${TESTOMATIO_REQUEST_TIMEOUT / 1000}s`);
}
const AXIOS_TIMEOUT = TESTOMATIO_REQUEST_TIMEOUT || 20 * 1000;
exports.AXIOS_TIMEOUT = AXIOS_TIMEOUT;
const TESTOMAT_TMP_STORAGE_DIR = path_1.default.join(os_1.default.tmpdir(), 'testomatio_tmp');
exports.TESTOMAT_TMP_STORAGE_DIR = TESTOMAT_TMP_STORAGE_DIR;
const CSV_HEADERS = [
    { id: 'suite_title', title: 'Suite_title' },
    { id: 'title', title: 'Title' },
    { id: 'status', title: 'Status' },
    { id: 'message', title: 'Message' },
    { id: 'stack', title: 'Stack' },
];
exports.CSV_HEADERS = CSV_HEADERS;
const STATUS = {
    PASSED: 'passed',
    FAILED: 'failed',
    SKIPPED: 'skipped',
    FINISHED: 'finished',
};
exports.STATUS = STATUS;
// html pipe var
const HTML_REPORT = {
    FOLDER: 'html-report',
    REPORT_DEFAULT_NAME: 'testomatio-report.html',
    TEMPLATE_NAME: 'testomatio.hbs',
};
exports.HTML_REPORT = HTML_REPORT;
const testomatLogoURL = 'https://avatars.githubusercontent.com/u/59105116?s=36&v=4';
exports.testomatLogoURL = testomatLogoURL;
const REPORTER_REQUEST_RETRIES = {
    retryTimeout: 5 * 1000, // sum = 5sec
    retriesPerRequest: 2,
    maxTotalRetries: Number(process.env.TESTOMATIO_MAX_REQUEST_FAILURES_COUNT) || 10,
    withinTimeSeconds: Number(process.env.TESTOMATIO_MAX_REQUEST_RETRIES_WITHIN_TIME_SECONDS) || 60,
};
exports.REPORTER_REQUEST_RETRIES = REPORTER_REQUEST_RETRIES;

module.exports.APP_PREFIX = APP_PREFIX;

module.exports.AXIOS_TIMEOUT = AXIOS_TIMEOUT;

module.exports.TESTOMAT_TMP_STORAGE_DIR = TESTOMAT_TMP_STORAGE_DIR;

module.exports.CSV_HEADERS = CSV_HEADERS;

module.exports.STATUS = STATUS;

module.exports.HTML_REPORT = HTML_REPORT;

module.exports.testomatLogoURL = testomatLogoURL;

module.exports.REPORTER_REQUEST_RETRIES = REPORTER_REQUEST_RETRIES;
