const fs = require('fs');
const path = require('path');
const os = require('os');
const { APP_PREFIX, STATUS, AXIOS_TIMEOUT } = require('../constants');
const { parseFilterParams, generateFilterRequestParams } = require('../utils/pipe_utils');
const { foundedTestLog } = require('../utils/utils');
const config = require('../config');
const axios = require('axios');
const debug = require('debug')('@testomatio/reporter:pipe:debug');

class DebugPipe {
  constructor(params, store) {
    this.isEnabled = process.env.TESTOMATIO_DEBUG == true;
    if (!this.isEnabled) return;

    this.batch = {
      isEnabled: params.isBatchEnabled ?? !process.env.TESTOMATIO_DISABLE_BATCH_UPLOAD ?? true,
      intervalFunction: null,
      intervalTime: 5000,
      tests: [],
      batchIndex: 0,
    };
    this.retriesTimestamps = [];
    this.reportingCanceledDueToReqFailures = false;
    this.notReportedTestsCount = 0;

    this.url = params.testomatioUrl || process.env.TESTOMATIO_URL || 'https://app.testomat.io';
    this.apiKey = params.apiKey || config.TESTOMATIO;
    if (!this.apiKey) {
      return;
    }
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

    this.proceed = process.env.TESTOMATIO_PROCEED;
    this.jiraId = process.env.TESTOMATIO_JIRA_ID;
    this.timestamp = new Date()
      .toISOString()
      .replace(/[-:T.Z]/g, '')
      .slice(0, 14);
    this.createNewTests = params.createNewTests ?? !!process.env.TESTOMATIO_CREATE;
    this.hasUnmatchedTests = false;
    this.axios = axios.create({
      baseURL: `${this.url.trim()}`,
      timeout: AXIOS_TIMEOUT,
      proxy: proxy
        ? {
            host: proxy.hostname,
            port: proxy.port,
            protocol: proxy.protocol,
          }
        : false,
    });
  }

  // Function to generate a unique file name
  #getLogFilePath(timestamp) {
    const tempFilePath = path.join(os.tmpdir(), `testomatio.debug.${timestamp}.json`);
    if (!fs.existsSync(tempFilePath)) {
      debug('Creating artifacts file:', tempFilePath);
      fs.writeFileSync(tempFilePath, '');
    }
    return tempFilePath;
  }

  logToFile(logData) {
    if (!this.isEnabled) return;
    const logLine = JSON.stringify(logData);
    fs.promises.appendFile(this.#getLogFilePath(this.timestamp), `${logLine}\n`).catch(err => {
      console.error('Error writing log to file:', err);
    });
  }

  /**
   * Asynchronously prepares and retrieves the Testomat.io test grepList based on the provided options.
   * @param {Object} opts - The options for preparing the test grepList.
   * @returns {Promise<string[]>} - An array containing the retrieved
   * test grepList, or an empty array if no tests are found or the request is disabled.
   * @throws {Error} - Throws an error if there was a problem while making the request.
   */
  async prepareRun(opts) {
    if (!this.isEnabled) return [];

    const { type, id } = parseFilterParams(opts);

    try {
      const q = generateFilterRequestParams({
        type,
        id,
        apiKey: this.apiKey.trim(),
      });

      if (!q) {
        return;
      }

      const resp = await this.axios.get('/api/test_grep', q);
      const { data } = resp;

      this.logToFile({ action: 'prepare_run_finished', data: data.tests, time: new Date().toISOString() });

      if (Array.isArray(data?.tests) && data?.tests?.length > 0) {
        foundedTestLog(APP_PREFIX, data.tests);
        return data.tests;
      }

      console.log(APP_PREFIX, `⛔  No tests found for your --filter --> ${type}=${id}`);
    } catch (err) {
      console.error(APP_PREFIX, `🚩 Error in debug pipe: ${err}`);
      this.logToFile({ action: 'prepare_run_error', error: err.message, time: new Date().toISOString() });
    }
  }

  /**
   * Creates a new run on Testomat.io
   * @param {{isBatchEnabled?: boolean}} params
   * @returns Promise<void>
   */
  async createRun(params = {}) {
    this.batch.isEnabled = params.isBatchEnabled ?? this.batch.isEnabled;
    if (!this.isEnabled) return;
    if (this.batch.isEnabled)
      this.batch.intervalFunction = setInterval(this.batchUpload.bind(this), this.batch.intervalTime);

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

    if (buildUrl && !buildUrl.startsWith('http')) buildUrl = undefined;

    const accessEvent = process.env.TESTOMATIO_PUBLISH ? 'publish' : null;

    const runParams = Object.fromEntries(
      Object.entries({
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
      }).filter(([, value]) => !!value),
    );
    console.log(APP_PREFIX, '🪲. Debug created:');

    this.logToFile({ action: 'create_run_params', runParams, time: new Date().toISOString() });
  }

  async addTest(data) {
    if (!this.isEnabled) return;

    data.api_key = this.apiKey;
    data.create = this.createNewTests;

    if (!this.batch.isEnabled) await this.uploadSingleTest(data);
    else this.batch.tests.push(data);

    if (!this.batch.intervalFunction) await this.batchUpload();

    this.logToFile({ action: 'add_test_finished', testId: data.testId, time: new Date().toISOString() });
  }

  async uploadSingleTest(data) {
    try {
      this.logToFile({ action: 'upload_started', testId: data.testId, time: new Date().toISOString() });

      data.api_key = this.apiKey;
      data.create = this.createNewTests;

      if (!process.env.TESTOMATIO_STACK_PASSED && data.status === STATUS.PASSED) {
        data.stack = null;
      }
      this.logToFile({ action: 'upload_finished', testId: data.testId, time: new Date().toISOString() });
    } catch (err) {
      this.logToFile({
        status: 'upload_failed',
        testId: data.testId,
        error: err.message,
        time: new Date().toISOString(),
      });
    }
  }

  async batchUpload() {
    this.batch.batchIndex++;
    if (!this.batch.isEnabled) return;
    if (!this.batch.tests.length) return;

    const testsToSend = this.batch.tests.splice(0);

    this.logToFile({ action: 'add_test', tests: testsToSend, time: new Date().toISOString() });
  }

  async finishRun(params) {
    if (!this.isEnabled) return;

    await this.batchUpload();
    if (this.batch.intervalFunction) clearInterval(this.batch.intervalFunction);

    const { status, parallel } = params;

    let status_event;

    if (status === STATUS.FINISHED) status_event = 'finish';
    if (status === STATUS.PASSED) status_event = 'pass';
    if (status === STATUS.FAILED) status_event = 'fail';
    if (parallel) status_event += '_parallel';

    try {
      if (!this.proceed) {
        this.logToFile({ action: 'finish_run', status_event, tests: params.tests, time: new Date().toISOString() });
      }
      if (this.runUrl && this.proceed) {
        const notFinishedMessage = 'Run was not finished because of $TESTOMATIO_PROCEED';
        console.log(APP_PREFIX, `🪲. ${notFinishedMessage}. Report URL: ${this.runUrl}`);
      }
      if (this.hasUnmatchedTests) {
        console.log('');
        // eslint-disable-next-line max-len
        console.log(APP_PREFIX, '⚠️ Some reported tests were not found in Testomat.io project');
        // eslint-disable-next-line max-len
        console.log(
          APP_PREFIX,
          `If you use Testomat.io as a reporter only, please re-run tests using TESTOMATIO_CREATE=1`,
        );
        console.log(APP_PREFIX, `But to keep your tests consistent it is recommended to import tests first`);
        console.log(APP_PREFIX, 'If tests were imported but still not matched, assign test IDs to your tests.');
        console.log(APP_PREFIX, 'You can do that automatically via command line tools:');
        console.log(APP_PREFIX, 'npx check-tests ... --update-ids', 'See: https://bit.ly/js-update-ids');
        console.log(APP_PREFIX, 'or for Cucumber:');
        // eslint-disable-next-line max-len
        console.log(APP_PREFIX, 'npx check-cucumber ... --update-ids', 'See: https://bit.ly/bdd-update-ids');
      }
    } catch (err) {
      console.log(APP_PREFIX, 'Error updating status, skipping...', err);
      this.logToFile({ action: 'finish_run_error', error: err.message, time: new Date().toISOString() });
    }
    console.log(APP_PREFIX, '🪲. Debug Saved.');
  }

  toString() {
    return 'Debug Reporter';
  }
}

module.exports = DebugPipe;
