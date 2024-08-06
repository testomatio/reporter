const debug = require('debug')('@testomatio/reporter:pipe:testomatio');
const chalk = require('chalk');
// Retry interceptor function
const axiosRetry = require('axios-retry');
// Default axios instance
const axios = require('axios');
const JsonCycle = require('json-cycle');

const { APP_PREFIX, STATUS, AXIOS_TIMEOUT, REPORTER_REQUEST_RETRIES } = require('../constants');
const { isValidUrl, foundedTestLog } = require('../utils/utils');
const { parseFilterParams, generateFilterRequestParams, setS3Credentials } = require('../utils/pipe_utils');
const config = require('../config');

if (process.env.TESTOMATIO_RUN) {
  process.env.runId = process.env.TESTOMATIO_RUN;
}

/**
 * @typedef {import('../../types').Pipe} Pipe
 * @typedef {import('../../types').TestData} TestData
 * @class TestomatioPipe
 * @implements {Pipe}
 */
class TestomatioPipe {
  constructor(params, store) {
    this.batch = {
      isEnabled: params.isBatchEnabled ?? !process.env.TESTOMATIO_DISABLE_BATCH_UPLOAD ?? true,
      intervalFunction: null, // will be created in createRun by setInterval function
      intervalTime: 5000, // how often tests are sent
      tests: [], // array of tests in batch
      batchIndex: 0, // represents the current batch index (starts from 1 and increments by 1 for each batch)
    };
    this.retriesTimestamps = [];
    this.reportingCanceledDueToReqFailures = false;
    this.notReportedTestsCount = 0;

    this.isEnabled = false;
    this.url = params.testomatioUrl || process.env.TESTOMATIO_URL || 'https://app.testomat.io';
    this.apiKey = params.apiKey || config.TESTOMATIO;
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
    this.groupTitle = params.groupTitle || process.env.TESTOMATIO_RUNGROUP_TITLE;
    this.env = process.env.TESTOMATIO_ENV;
    this.label = process.env.TESTOMATIO_LABEL;
    // Create a new instance of axios with a custom config
    this.axios = axios.create({
      baseURL: `${this.url.trim()}`,
      timeout: AXIOS_TIMEOUT,
      proxy: proxy ? {
        host: proxy.hostname,
        port: proxy.port,
        protocol: proxy.protocol,
      } : false,
    });

    // Pass the axios instance to the retry function
    axiosRetry(this.axios, {
      // do not use retries for unit tests
      retries: REPORTER_REQUEST_RETRIES.retriesPerRequest, // Number of retries
      shouldResetTimeout: true,
      retryCondition: error => {
        if (!error.response) return false;
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
      retryDelay: () => REPORTER_REQUEST_RETRIES.retryTimeout, // sum = 15sec
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

    if (!isValidUrl(this.url.trim())) {
      this.isEnabled = false;
      console.error(APP_PREFIX, chalk.red(`Error creating report on Testomat.io, report url '${this.url}' is invalid`));
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

      if (Array.isArray(data?.tests) && data?.tests?.length > 0) {
        foundedTestLog(APP_PREFIX, data.tests);
        return data.tests;
      }

      console.log(APP_PREFIX, `⛔  No tests found for your --filter --> ${type}=${id}`);
    } catch (err) {
      console.error(APP_PREFIX, `🚩 Error getting Testomat.io test grepList: ${err}`);
    }
  }

  /**
   * Creates a new run on Testomat.io
   * @param {{isBatchEnabled?: boolean}} params
   * @returns Promise<void>
   */
  async createRun(params = {}) {
    this.batch.isEnabled = params.isBatchEnabled ?? this.batch.isEnabled;
    debug('Creating run...');
    if (!this.isEnabled) return;
    if (this.batch.isEnabled) this.batch.intervalFunction = setInterval(this.#batchUpload, this.batch.intervalTime);

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
      }).filter(([, value]) => !!value),
    );
    debug('Run params', JSON.stringify(runParams, null, 2));

    if (this.runId) {
      debug(`Run with id ${this.runId} already created, updating...`);
      const resp = await this.axios.put(`/api/reporter/${this.runId}`, runParams);
      if (resp.data.artifacts) setS3Credentials(resp.data.artifacts);
      return;
    }

    try {
      const resp = await this.axios.post(`/api/reporter`, runParams, {
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      this.runId = resp.data.uid;
      this.runUrl = `${this.url}/${resp.data.url.split('/').splice(3).join('/')}`;
      this.runPublicUrl = resp.data.public_url;

      if (resp.data.artifacts) setS3Credentials(resp.data.artifacts);

      this.store.runUrl = this.runUrl;
      this.store.runPublicUrl = this.runPublicUrl;
      this.store.runId = this.runId;
      console.log(APP_PREFIX, '📊 Report created. Report ID:', this.runId);
      process.env.runId = this.runId;
      debug('Run created', this.runId);
    } catch (err) {
      console.error(
        APP_PREFIX,
        'Error creating Testomat.io report, please check if your API key is valid. Skipping report | ',
        err?.response?.statusText || err?.status || err.message,
      );
      printCreateIssue(err);
    }
    debug('"createRun" function finished');
  }

  /**
   * Decides whether to skip test reporting in case of too many request failures
   * @param {TestData} testData
   * @returns {boolean}
   */
  #cancelTestReportingInCaseOfTooManyReqFailures(testData) {
    if (this.reportingCanceledDueToReqFailures) return true;

    const retriesCountWithinTime = this.retriesTimestamps.filter(
      timestamp => Date.now() - timestamp < REPORTER_REQUEST_RETRIES.withinTimeSeconds * 1000,
    ).length;
    debug(`${retriesCountWithinTime} failed requests within ${REPORTER_REQUEST_RETRIES.withinTimeSeconds}s`);

    if (retriesCountWithinTime > REPORTER_REQUEST_RETRIES.maxTotalRetries) {
      const errorMessage = chalk.yellow(
        `${retriesCountWithinTime} requests were failed within ${REPORTER_REQUEST_RETRIES.withinTimeSeconds}s,\
 reporting for test "${testData.title}" to Testomat is skipped`,
      );
      console.warn(`${APP_PREFIX} ${errorMessage}`);

      this.reportingCanceledDueToReqFailures = true;
      this.notReportedTestsCount++;

      return true;
    }

    return false;
  }

  #uploadSingleTest = async data => {
    if (!this.isEnabled) return;
    if (!this.runId) return;
    if (this.#cancelTestReportingInCaseOfTooManyReqFailures(data)) return;

    data.api_key = this.apiKey;
    data.create = this.createNewTests;

    if (!process.env.TESTOMATIO_STACK_PASSED && data.status === STATUS.PASSED) {
      data.stack = null;
    }

    const json = JsonCycle.stringify(data);

    debug('Adding test', json);

    return this.axios
      .post(`/api/reporter/${this.runId}/testrun`, json, axiosAddTestrunRequestConfig)
      .catch(err => {
        if (err.response) {
          if (err.response.status >= 400) {
            const responseData = err.response.data || { message: '' };
            console.log(
              APP_PREFIX,
              chalk.yellow(`Warning: ${responseData.message} (${err.response.status})`),
              chalk.grey(data?.title || ''),
            );
            if (err.response?.data?.message?.includes('could not be matched')) {
              this.hasUnmatchedTests = true;
            }
            return;
          }
          console.log(
            APP_PREFIX,
            chalk.yellow(`Warning: ${data?.title || ''} (${err.response?.status})`),
            `Report couldn't be processed: ${err?.response?.data?.message}`,
          );
          printCreateIssue(err);
        } else {
          console.log(APP_PREFIX, chalk.blue(data?.title || ''), "Report couldn't be processed", err);
        }
      });
    };
    

  /**
   * Uploads tests as a batch (multiple tests at once). Intended to be used with a setInterval
   */
  #batchUpload = async () => {
    this.batch.batchIndex++;
    if (!this.batch.isEnabled) return;
    if (!this.batch.tests.length) return;

    // get tests from batch and clear batch
    const testsToSend = this.batch.tests.splice(0);
    debug('📨 Batch upload', testsToSend.length, 'tests');

    return this.axios
      .post(
        `/api/reporter/${this.runId}/testrun`,
        { api_key: this.apiKey, tests: testsToSend, batch_index: this.batch.batchIndex },
        axiosAddTestrunRequestConfig,
      )
      .catch(err => {
        if (err.response) {
          if (err.response.status >= 400) {
            const responseData = err.response.data || { message: '' };
            console.log(
              APP_PREFIX,
              chalk.yellow(`Warning: ${responseData.message} (${err.response.status})`),
              // chalk.grey(data?.title || ''),
            );
            if (err.response?.data?.message?.includes('could not be matched')) {
              this.hasUnmatchedTests = true;
            }
            return;
          }
          console.log(
            APP_PREFIX,
            chalk.yellow(`Warning: (${err.response?.status})`),
            `Report couldn't be processed: ${err?.response?.data?.message}`,
          );
          printCreateIssue(err);
        } else {
          console.log(APP_PREFIX, "Report couldn't be processed", err);
        }
      });
  };

  /**
   * Adds a test to the batch uploader (or reports a single test if batch uploading is disabled)
   */
  addTest(data) {
    if (!this.isEnabled) return;
    if (!this.runId) return;

    // add test ID + run ID
    if (data.rid) data.rid = `${this.runId}-${data.rid}`;
    data.api_key = this.apiKey;
    data.create = this.createNewTests;

    if (!this.batch.isEnabled) this.#uploadSingleTest(data);
    else this.batch.tests.push(data);

    // if test is added after run already finished
    if (!this.batch.intervalFunction) this.#batchUpload();
  }

  /**
   * @param {import('../../types').RunData} params
   * @returns
   */
  async finishRun(params) {
    if (!this.isEnabled) return;
    
    await this.#batchUpload();
    if (this.batch.intervalFunction) clearInterval(this.batch.intervalFunction);

    debug('Finishing run...');

    if (this.reportingCanceledDueToReqFailures) {
      const errorMessage = chalk.red(
        `⚠️ Due to request failures, ${this.notReportedTestsCount} test(s) were not reported to Testomat.io`,
      );
      console.warn(`${APP_PREFIX} ${errorMessage}`);
    }

    const { status, parallel } = params;

    let status_event;

    if (status === STATUS.FINISHED) status_event = 'finish';
    if (status === STATUS.PASSED) status_event = 'pass';
    if (status === STATUS.FAILED) status_event = 'fail';
    if (parallel) status_event += '_parallel';

    try {
      if (this.runId && !this.proceed) {
        await this.axios.put(`/api/reporter/${this.runId}`, {
          api_key: this.apiKey,
          status_event,
          tests: params.tests,
        });
        if (this.runUrl) {
          console.log(APP_PREFIX, '📊 Report Saved. Report URL:', chalk.magenta(this.runUrl));
        }
        if (this.runPublicUrl) {
          console.log(APP_PREFIX, '🌟 Public URL:', chalk.magenta(this.runPublicUrl));
        }
      }
      if (this.runUrl && this.proceed) {
        const notFinishedMessage = chalk.yellow.bold('Run was not finished because of $TESTOMATIO_PROCEED');
        console.log(APP_PREFIX, `📊 ${notFinishedMessage}. Report URL: ${chalk.magenta(this.runUrl)}`);
        console.log(APP_PREFIX, `🛬 Run to finish it: TESTOMATIO_RUN=${this.runId} npx start-test-run --finish`);
      }
      if (this.hasUnmatchedTests) {
        console.log('');
        // eslint-disable-next-line max-len
        console.log(APP_PREFIX, chalk.yellow.bold('⚠️ Some reported tests were not found in Testomat.io project'));
        // eslint-disable-next-line max-len
        console.log(
          APP_PREFIX,
          `If you use Testomat.io as a reporter only, please re-run tests using ${chalk.bold('TESTOMATIO_CREATE=1')}`,
        );
        // eslint-disable-next-line max-len
        console.log(
          APP_PREFIX,
          `But to keep your tests consistent it is recommended to ${chalk.bold('import tests first')}`,
        );
        console.log(APP_PREFIX, 'If tests were imported but still not matched, assign test IDs to your tests.');
        console.log(APP_PREFIX, 'You can do that automatically via command line tools:');
        console.log(APP_PREFIX, chalk.bold('npx check-tests ... --update-ids'), 'See: https://bit.ly/js-update-ids');
        console.log(APP_PREFIX, 'or for Cucumber:');
        // eslint-disable-next-line max-len
        console.log(
          APP_PREFIX,
          chalk.bold('npx check-cucumber ... --update-ids'),
          'See: https://bit.ly/bdd-update-ids',
        );
      }
    } catch (err) {
      console.log(APP_PREFIX, 'Error updating status, skipping...', err);
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
  if (registeredErrorHints) return;
  registeredErrorHints = true;
  process.on('exit', () => {
    console.log();
    console.log(APP_PREFIX, 'There was an error reporting to Testomat.io:');
    console.log(
      APP_PREFIX,
      'If you think this is a bug please create an issue: https://github.com/testomatio/reporter/issues/new',
    ); // eslint-disable-line max-len
    console.log(APP_PREFIX, 'Provide this information:');
    console.log('Error:', err.message || err.code);
    if (!err.config) return;

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
