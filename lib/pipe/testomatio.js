"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const debug_1 = __importDefault(require("debug"));
const picocolors_1 = __importDefault(require("picocolors"));
// Retry interceptor function
const axios_retry_1 = __importDefault(require("axios-retry"));
// Default axios instance
const axios_1 = __importDefault(require("axios"));
const json_cycle_1 = __importDefault(require("json-cycle"));
const constants_js_1 = require("../constants.js");
const utils_js_1 = require("../utils/utils.js");
const pipe_utils_js_1 = require("../utils/pipe_utils.js");
const config_js_1 = require("../config.js");
const debug = (0, debug_1.default)('@testomatio/reporter:pipe:testomatio');
if (process.env.TESTOMATIO_RUN) {
    // process.env.runId = process.env.TESTOMATIO_RUN;
}
/**
 * @typedef {import('../../types/types.js').Pipe} Pipe
 * @typedef {import('../../types/types.js').TestData} TestData
 * @class TestomatioPipe
 * @implements {Pipe}
 */
class TestomatioPipe {
    constructor(params, store) {
        this.batch = {
            isEnabled: params?.isBatchEnabled ?? !process.env.TESTOMATIO_DISABLE_BATCH_UPLOAD ?? true,
            intervalFunction: null, // will be created in createRun by setInterval function
            intervalTime: 5000, // how often tests are sent
            tests: [], // array of tests in batch
            batchIndex: 0, // represents the current batch index (starts from 1 and increments by 1 for each batch)
            numberOfTimesCalledWithoutTests: 0, // how many times batch was called without tests
        };
        this.retriesTimestamps = [];
        this.reportingCanceledDueToReqFailures = false;
        this.notReportedTestsCount = 0;
        this.isEnabled = false;
        this.url = params.testomatioUrl || process.env.TESTOMATIO_URL || 'https://app.testomat.io';
        this.apiKey = params.apiKey || config_js_1.config.TESTOMATIO;
        debug('Testomatio Pipe: ', this.apiKey ? 'API KEY' : '*no api key*');
        if (!this.apiKey) {
            return;
        }
        debug('Testomatio Pipe: Enabled');
        const proxyUrl = process.env.HTTP_PROXY || process.env.HTTPS_PROXY;
        const proxy = proxyUrl ? new URL(proxyUrl) : null;
        this.parallel = params.parallel;
        this.store = store || {};
        this.title = params.title || process.env.TESTOMATIO_TITLE;
        this.sharedRun = !!process.env.TESTOMATIO_SHARED_RUN;
        this.sharedRunTimeout = !!process.env.TESTOMATIO_SHARED_RUN_TIMEOUT;
        this.groupTitle = params.groupTitle || process.env.TESTOMATIO_RUNGROUP_TITLE;
        this.env = process.env.TESTOMATIO_ENV;
        this.label = process.env.TESTOMATIO_LABEL;
        // Create a new instance of axios with a custom config
        this.axios = axios_1.default.create({
            baseURL: `${this.url.trim()}`,
            timeout: constants_js_1.AXIOS_TIMEOUT,
            proxy: proxy ? {
                host: proxy.hostname,
                port: parseInt(proxy.port, 10),
                protocol: proxy.protocol,
            } : false,
        });
        // Pass the axios instance to the retry function
        (0, axios_retry_1.default)(this.axios, {
            // do not use retries for unit tests
            retries: constants_js_1.REPORTER_REQUEST_RETRIES.retriesPerRequest, // Number of retries
            shouldResetTimeout: true,
            retryCondition: error => {
                if (!error.response)
                    return false;
                switch (error.response?.status) {
                    case 400: // Bad request (probably wrong API key)
                    case 404: // Test not matched
                    case 429: // Rate limit exceeded
                    case 500: // Internal server error
                        return false;
                    default:
                        break;
                }
                return error.response?.status >= 401; // Retry on 401+ and 5xx
            },
            retryDelay: () => constants_js_1.REPORTER_REQUEST_RETRIES.retryTimeout, // sum = 15sec
            onRetry: async (retryCount, error) => {
                this.retriesTimestamps.push(Date.now());
                debug(`${error.message || `Request failed ${error.status}`}. Retry #${retryCount} ...`);
            },
        });
        this.isEnabled = true;
        // do not finish this run (for parallel testing)
        this.proceed = process.env.TESTOMATIO_PROCEED;
        this.jiraId = process.env.TESTOMATIO_JIRA_ID;
        this.runId = params.runId || process.env.runId;
        this.createNewTests = params.createNewTests ?? !!process.env.TESTOMATIO_CREATE;
        this.hasUnmatchedTests = false;
        this.requestFailures = 0;
        if (!(0, utils_js_1.isValidUrl)(this.url.trim())) {
            this.isEnabled = false;
            console.error(constants_js_1.APP_PREFIX, picocolors_1.default.red(`Error creating report on Testomat.io, report url '${this.url}' is invalid`));
        }
    }
    /**
     * Asynchronously prepares and retrieves the Testomat.io test grepList based on the provided options.
     * @param {Object} opts - The options for preparing the test grepList.
     * @returns {Promise<string[]>} - An array containing the retrieved
     * test grepList, or an empty array if no tests are found or the request is disabled.
     * @throws {Error} - Throws an error if there was a problem while making the request.
     */
    async prepareRun(opts) {
        if (!this.isEnabled)
            return [];
        const { type, id } = (0, pipe_utils_js_1.parseFilterParams)(opts);
        try {
            const q = (0, pipe_utils_js_1.generateFilterRequestParams)({
                type,
                id,
                apiKey: this.apiKey.trim(),
            });
            if (!q) {
                return;
            }
            const resp = await this.axios.get('/api/test_grep', q);
            const { data } = resp;
            if (Array.isArray(data?.tests) && data?.tests?.length > 0) {
                (0, utils_js_1.foundedTestLog)(constants_js_1.APP_PREFIX, data.tests);
                return data.tests;
            }
            console.log(constants_js_1.APP_PREFIX, `⛔  No tests found for your --filter --> ${type}=${id}`);
        }
        catch (err) {
            console.error(constants_js_1.APP_PREFIX, `🚩 Error getting Testomat.io test grepList: ${err}`);
        }
    }
    /**
     * Creates a new run on Testomat.io
     * @param {{isBatchEnabled?: boolean}} params
     * @returns Promise<void>
     */
    async createRun(params = {}) {
        this.batch.isEnabled = params.isBatchEnabled ?? this.batch.isEnabled;
        if (!this.isEnabled)
            return;
        if (this.batch.isEnabled && this.isEnabled)
            this.batch.intervalFunction = setInterval(this.#batchUpload, this.batch.intervalTime);
        let buildUrl = process.env.BUILD_URL || process.env.CI_JOB_URL || process.env.CIRCLE_BUILD_URL;
        // GitHub Actions Url
        if (!buildUrl && process.env.GITHUB_RUN_ID) {
            // eslint-disable-next-line max-len
            buildUrl = `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
        }
        // Azure DevOps Url
        if (!buildUrl && process.env.SYSTEM_TEAMFOUNDATIONCOLLECTIONURI) {
            const collectionUri = process.env.SYSTEM_TEAMFOUNDATIONCOLLECTIONURI;
            const project = process.env.SYSTEM_TEAMPROJECT;
            const buildId = process.env.BUILD_BUILDID;
            buildUrl = `${collectionUri}/${project}/_build/results?buildId=${buildId}`;
        }
        if (buildUrl && !buildUrl.startsWith('http'))
            buildUrl = undefined;
        const accessEvent = process.env.TESTOMATIO_PUBLISH ? 'publish' : null;
        const runParams = Object.fromEntries(Object.entries({
            ci_build_url: buildUrl,
            parallel: this.parallel,
            api_key: this.apiKey.trim(),
            group_title: this.groupTitle,
            access_event: accessEvent,
            jira_id: this.jiraId,
            env: this.env,
            title: this.title,
            label: this.label,
            shared_run: this.sharedRun,
            shared_run_timeout: this.sharedRunTimeout,
        }).filter(([, value]) => !!value));
        debug(' >>>>>> Run params', JSON.stringify(runParams, null, 2));
        if (this.runId) {
            this.store.runId = this.runId;
            debug(`Run with id ${this.runId} already created, updating...`);
            const resp = await this.axios.put(`/api/reporter/${this.runId}`, runParams);
            if (resp.data.artifacts)
                (0, pipe_utils_js_1.setS3Credentials)(resp.data.artifacts);
            return;
        }
        debug('Creating run...');
        try {
            const resp = await this.axios.post(`/api/reporter`, runParams, {
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
            });
            this.runId = resp.data.uid;
            this.runUrl = `${this.url}/${resp.data.url.split('/').splice(3).join('/')}`;
            this.runPublicUrl = resp.data.public_url;
            if (resp.data.artifacts)
                (0, pipe_utils_js_1.setS3Credentials)(resp.data.artifacts);
            this.store.runUrl = this.runUrl;
            this.store.runPublicUrl = this.runPublicUrl;
            this.store.runId = this.runId;
            console.log(constants_js_1.APP_PREFIX, '📊 Report created. Report ID:', this.runId);
            process.env.runId = this.runId;
            debug('Run created', this.runId);
        }
        catch (err) {
            const errorText = err.response?.data?.message || err.message;
            console.log(errorText || err);
            if (!this.apiKey)
                console.error('Testomat.io API key is not set');
            if (!this.apiKey?.startsWith('tstmt'))
                console.error('Testomat.io API key is invalid');
            console.error(constants_js_1.APP_PREFIX, 'Error creating Testomat.io report (see details above), please check if your API key is valid. Skipping report');
            printCreateIssue(err);
        }
        debug('"createRun" function finished');
    }
    /**
     * Decides whether to skip test reporting in case of too many request failures
     * @returns {boolean}
     */
    #cancelTestReportingInCaseOfTooManyReqFailures() {
        if (!process.env.TESTOMATIO_MAX_REQUEST_FAILURES)
            return;
        const cancelReporting = this.requestFailures >= parseInt(process.env.TESTOMATIO_MAX_REQUEST_FAILURES, 10);
        if (cancelReporting) {
            this.reportingCanceledDueToReqFailures = true;
            const errorMessage = `⚠️ ${process.env.TESTOMATIO_MAX_REQUEST_FAILURES} requests were failed, reporting to Testomat aborted.`;
            console.warn(`${constants_js_1.APP_PREFIX} ${picocolors_1.default.yellow(errorMessage)}`);
        }
        return cancelReporting;
    }
    #uploadSingleTest = async (data) => {
        if (!this.isEnabled)
            return;
        if (!this.runId)
            return;
        if (this.#cancelTestReportingInCaseOfTooManyReqFailures())
            return;
        data.api_key = this.apiKey;
        data.create = this.createNewTests;
        if (!process.env.TESTOMATIO_STACK_PASSED && data.status === constants_js_1.STATUS.PASSED) {
            data.stack = null;
        }
        const json = json_cycle_1.default.stringify(data);
        debug('Adding test', json);
        return this.axios
            .post(`/api/reporter/${this.runId}/testrun`, json, axiosAddTestrunRequestConfig)
            .catch(err => {
            this.requestFailures++;
            this.notReportedTestsCount++;
            if (err.response) {
                if (err.response.status >= 400) {
                    const responseData = err.response.data || { message: '' };
                    console.log(constants_js_1.APP_PREFIX, picocolors_1.default.yellow(`Warning: ${responseData.message} (${err.response.status})`), picocolors_1.default.gray(data?.title || ''));
                    if (err.response?.data?.message?.includes('could not be matched')) {
                        this.hasUnmatchedTests = true;
                    }
                    return;
                }
                console.log(constants_js_1.APP_PREFIX, picocolors_1.default.yellow(`Warning: ${data?.title || ''} (${err.response?.status})`), `Report couldn't be processed: ${err?.response?.data?.message}`);
                printCreateIssue(err);
            }
            else {
                console.log(constants_js_1.APP_PREFIX, picocolors_1.default.blue(data?.title || ''), "Report couldn't be processed", err);
            }
        });
    };
    /**
     * Uploads tests as a batch (multiple tests at once). Intended to be used with a setInterval
     */
    #batchUpload = async () => {
        if (!this.batch.isEnabled)
            return;
        if (!this.batch.tests.length)
            return;
        if (this.#cancelTestReportingInCaseOfTooManyReqFailures())
            return;
        // prevent infinite loop
        if (this.batch.numberOfTimesCalledWithoutTests > 10) {
            debug('📨 Batch upload: no tests to send for 10 times, stopping batch');
            clearInterval(this.batch.intervalFunction);
            this.batch.isEnabled = false;
        }
        if (!this.batch.tests.length) {
            debug('📨 Batch upload: no tests to send');
            this.batch.numberOfTimesCalledWithoutTests++;
            return;
        }
        this.batch.batchIndex++;
        // get tests from batch and clear batch
        const testsToSend = this.batch.tests.splice(0);
        debug('📨 Batch upload', testsToSend.length, 'tests');
        return this.axios
            .post(`/api/reporter/${this.runId}/testrun`, { api_key: this.apiKey, tests: testsToSend, batch_index: this.batch.batchIndex }, axiosAddTestrunRequestConfig)
            .catch(err => {
            this.requestFailures++;
            this.notReportedTestsCount += testsToSend.length;
            if (err.response) {
                if (err.response.status >= 400) {
                    const responseData = err.response.data || { message: '' };
                    console.log(constants_js_1.APP_PREFIX, picocolors_1.default.yellow(`Warning: ${responseData.message} (${err.response.status})`));
                    if (err.response?.data?.message?.includes('could not be matched')) {
                        this.hasUnmatchedTests = true;
                    }
                    return;
                }
                console.log(constants_js_1.APP_PREFIX, picocolors_1.default.yellow(`Warning: (${err.response?.status})`), `Report couldn't be processed: ${err?.response?.data?.message}`);
                printCreateIssue(err);
            }
            else {
                console.log(constants_js_1.APP_PREFIX, "Report couldn't be processed", err);
            }
        });
    };
    /**
     * Adds a test to the batch uploader (or reports a single test if batch uploading is disabled)
     */
    addTest(data) {
        if (!this.isEnabled)
            return;
        if (!this.runId)
            return;
        // add test ID + run ID
        if (data.rid)
            data.rid = `${this.runId}-${data.rid}`;
        data.api_key = this.apiKey;
        data.create = this.createNewTests;
        if (!this.batch.isEnabled)
            this.#uploadSingleTest(data);
        else
            this.batch.tests.push(data);
        // if test is added after run which is already finished
        if (!this.batch.intervalFunction)
            this.#batchUpload();
    }
    /**
     * @param {import('../../types/types.js').RunData} params
     * @returns
     */
    async finishRun(params) {
        if (!this.isEnabled)
            return;
        await this.#batchUpload();
        if (this.batch.intervalFunction) {
            clearInterval(this.batch.intervalFunction);
            // this code is required in case test is added after run is finished
            // (e.g. if test has artifacts, add test function will be invoked only after artifacts are uploaded)
            // batch stops working after run is finished; thus, disable it to use single test uploading
            this.batch.intervalFunction = null;
            this.batch.isEnabled = false;
        }
        debug('Finishing run...');
        if (this.reportingCanceledDueToReqFailures) {
            const errorMessage = picocolors_1.default.red(`⚠️ Due to request failures, ${this.notReportedTestsCount} test(s) were not reported to Testomat.io`);
            console.warn(`${constants_js_1.APP_PREFIX} ${errorMessage}`);
        }
        const { status, parallel } = params;
        let status_event;
        if (status === constants_js_1.STATUS.FINISHED)
            status_event = 'finish';
        if (status === constants_js_1.STATUS.PASSED)
            status_event = 'pass';
        if (status === constants_js_1.STATUS.FAILED)
            status_event = 'fail';
        if (parallel)
            status_event += '_parallel';
        try {
            if (this.runId && !this.proceed) {
                await this.axios.put(`/api/reporter/${this.runId}`, {
                    api_key: this.apiKey,
                    duration: params.duration,
                    status_event,
                    detach: params.detach,
                    tests: params.tests,
                });
                if (this.runUrl) {
                    console.log(constants_js_1.APP_PREFIX, '📊 Report Saved. Report URL:', picocolors_1.default.magenta(this.runUrl));
                }
                if (this.runPublicUrl) {
                    console.log(constants_js_1.APP_PREFIX, '🌟 Public URL:', picocolors_1.default.magenta(this.runPublicUrl));
                }
            }
            if (this.runUrl && this.proceed) {
                const notFinishedMessage = picocolors_1.default.yellow(picocolors_1.default.bold('Run was not finished because of $TESTOMATIO_PROCEED'));
                console.log(constants_js_1.APP_PREFIX, `📊 ${notFinishedMessage}. Report URL: ${picocolors_1.default.magenta(this.runUrl)}`);
                console.log(constants_js_1.APP_PREFIX, `🛬 Run to finish it: TESTOMATIO_RUN=${this.runId} npx start-test-run --finish`);
            }
            if (this.hasUnmatchedTests) {
                console.log('');
                // eslint-disable-next-line max-len
                console.log(constants_js_1.APP_PREFIX, picocolors_1.default.yellow(picocolors_1.default.bold('⚠️ Some reported tests were not found in Testomat.io project')));
                // eslint-disable-next-line max-len
                console.log(constants_js_1.APP_PREFIX, `If you use Testomat.io as a reporter only, please re-run tests using ${picocolors_1.default.bold('TESTOMATIO_CREATE=1')}`);
                // eslint-disable-next-line max-len
                console.log(constants_js_1.APP_PREFIX, `But to keep your tests consistent it is recommended to ${picocolors_1.default.bold('import tests first')}`);
                console.log(constants_js_1.APP_PREFIX, 'If tests were imported but still not matched, assign test IDs to your tests.');
                console.log(constants_js_1.APP_PREFIX, 'You can do that automatically via command line tools:');
                console.log(constants_js_1.APP_PREFIX, picocolors_1.default.bold('npx check-tests ... --update-ids'), 'See: https://bit.ly/js-update-ids');
                console.log(constants_js_1.APP_PREFIX, 'or for Cucumber:');
                // eslint-disable-next-line max-len
                console.log(constants_js_1.APP_PREFIX, picocolors_1.default.bold('npx check-cucumber ... --update-ids'), 'See: https://bit.ly/bdd-update-ids');
            }
        }
        catch (err) {
            console.log(constants_js_1.APP_PREFIX, 'Error updating status, skipping...', err);
            printCreateIssue(err);
        }
        debug('Run finished');
    }
    toString() {
        return 'Testomatio Reporter';
    }
}
let registeredErrorHints = false;
function printCreateIssue(err) {
    if (registeredErrorHints)
        return;
    registeredErrorHints = true;
    process.on('exit', () => {
        console.log();
        console.log(constants_js_1.APP_PREFIX, 'There was an error reporting to Testomat.io:');
        console.log(constants_js_1.APP_PREFIX, 'If you think this is a bug please create an issue: https://github.com/testomatio/reporter/issues/new'); // eslint-disable-line max-len
        console.log(constants_js_1.APP_PREFIX, 'Provide this information:');
        console.log('Error:', err.message || err.code);
        if (!err.config)
            return;
        const time = new Date().toUTCString();
        const { data, url, baseURL, method } = err?.config || {};
        console.log('```js');
        console.log({ data: data?.replace(/"(tstmt_[^"]+)"/g, 'tstmt_*'), url, baseURL, method, time });
        console.log('```');
    });
}
const axiosAddTestrunRequestConfig = {
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    headers: {
        // Overwrite Axios's automatically set Content-Type
        'Content-Type': 'application/json',
    },
};
module.exports = TestomatioPipe;
