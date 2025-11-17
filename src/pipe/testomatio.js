import createDebugMessages from 'debug';
import pc from 'picocolors';
import { Gaxios } from 'gaxios';
import JsonCycle from 'json-cycle';
import { APP_PREFIX, STATUS, AXIOS_TIMEOUT, REPORTER_REQUEST_RETRIES } from '../constants.js';
import { isValidUrl, foundedTestLog, readLatestRunId, transformEnvVarToBoolean } from '../utils/utils.js';
import { parseFilterParams, generateFilterRequestParams, setS3Credentials } from '../utils/pipe_utils.js';
import { config } from '../config.js';

const debug = createDebugMessages('@testomatio/reporter:pipe:testomatio');

if (process.env.TESTOMATIO_RUN) process.env.runId = process.env.TESTOMATIO_RUN;

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
    this.apiKey = params.apiKey || config.TESTOMATIO;
    debug('Testomatio Pipe: ', this.apiKey ? 'API KEY' : '*no api key*');
    if (!this.apiKey) {
      return;
    }
    debug('Testomatio Pipe: Enabled');

    const proxyUrl = process.env.HTTP_PROXY || process.env.HTTPS_PROXY;
    const proxy = proxyUrl ? new URL(proxyUrl) : null;

    this.store = store || {};
    this.title = params.title || process.env.TESTOMATIO_TITLE;
    this.sharedRun = !!process.env.TESTOMATIO_SHARED_RUN;
    this.sharedRunTimeout = !!process.env.TESTOMATIO_SHARED_RUN_TIMEOUT;
    this.groupTitle = params.groupTitle || process.env.TESTOMATIO_RUNGROUP_TITLE;
    this.env = process.env.TESTOMATIO_ENV;
    this.label = process.env.TESTOMATIO_LABEL;

    // Create a new instance of gaxios with a custom config
    this.client = new Gaxios({
      baseURL: `${this.url.trim()}`,
      timeout: AXIOS_TIMEOUT,
      proxy: proxy ? proxy.toString() : undefined,
      retry: true,
      retryConfig: {
        retry: REPORTER_REQUEST_RETRIES.retriesPerRequest,
        retryDelay: REPORTER_REQUEST_RETRIES.retryTimeout,
        httpMethodsToRetry: ['GET', 'PUT', 'HEAD', 'OPTIONS', 'DELETE', 'POST'],
        shouldRetry: error => {
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
      },
    });

    this.isEnabled = true;
    // do not finish this run (for parallel testing)
    this.proceed = transformEnvVarToBoolean(process.env.TESTOMATIO_PROCEED);
    this.jiraId = process.env.TESTOMATIO_JIRA_ID;
    this.runId = params.runId || process.env.TESTOMATIO_RUN;
    this.createNewTests = params.createNewTests ?? !!process.env.TESTOMATIO_CREATE;
    this.hasUnmatchedTests = false;
    this.requestFailures = 0;

    if (!isValidUrl(this.url.trim())) {
      this.isEnabled = false;
      console.error(APP_PREFIX, pc.red(`Error creating report on Testomat.io, report url '${this.url}' is invalid`));
    }
  }

  /**
   * Prepares data for sending to Testomat.io.
   * @param {*} data - The data to be formatted.
   * @returns
   */
  #formatData(data) {
    data.api_key = this.apiKey;
    data.create = this.createNewTests;

    // add test ID + run ID
    if (data.rid) data.rid = `${this.runId}-${data.rid}`;

    if (!process.env.TESTOMATIO_STACK_PASSED && data.status === STATUS.PASSED) {
      data.stack = null;
    }

    if (!process.env.TESTOMATIO_STEPS_PASSED && data.status === STATUS.PASSED) {
      data.steps = null;
    }

    if (process.env.TESTOMATIO_NO_STEPS) {
      data.steps = null;
    }

    return data;
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

      const resp = await this.client.request({
        method: 'GET',
        url: '/api/test_grep',
        ...q,
      });

      if (Array.isArray(resp.data?.tests) && resp.data?.tests?.length > 0) {
        foundedTestLog(APP_PREFIX, resp.data.tests);
        return resp.data.tests;
      }

      console.log(APP_PREFIX, `⛔  No tests found for your --filter --> ${type}=${id}`);
    } catch (err) {
      console.error(APP_PREFIX, `🚩 Error getting Testomat.io test grepList: ${err}`);
    }
  }

  /**
   * Creates a new run on Testomat.io
   * @param {{isBatchEnabled?: boolean, kind?: string}} params
   * @returns Promise<void>
   */
  async createRun(params = {}) {
    this.batch.isEnabled = params.isBatchEnabled ?? this.batch.isEnabled;
    if (!this.isEnabled) return;
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

    if (buildUrl && !buildUrl.startsWith('http')) buildUrl = undefined;

    const accessEvent = process.env.TESTOMATIO_PUBLISH ? 'publish' : null;

    const runParams = Object.fromEntries(
      Object.entries({
        ci_build_url: buildUrl,
        api_key: this.apiKey.trim(),
        group_title: this.groupTitle,
        access_event: accessEvent,
        jira_id: this.jiraId,
        env: this.env,
        title: this.title,
        label: this.label,
        shared_run: this.sharedRun,
        shared_run_timeout: this.sharedRunTimeout,
        kind: params.kind,
      }).filter(([, value]) => !!value),
    );
    debug(' >>>>>> Run params', JSON.stringify(runParams, null, 2));

    if (this.runId) {
      this.store.runId = this.runId;
      debug(`Run with id ${this.runId} already created, updating...`);
      const resp = await this.client.request({
        method: 'PUT',
        url: `/api/reporter/${this.runId}`,
        data: runParams,
        responseType: 'json',
      });
      if (resp.data.artifacts) setS3Credentials(resp.data.artifacts);
      return;
    }

    debug('Creating run...');
    try {
      const resp = await this.client.request({
        method: 'POST',
        url: '/api/reporter',
        data: runParams,
        maxContentLength: Infinity,
        responseType: 'json',
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
      const errorText = err.response?.data?.message || err.message;
      debug('Error creating run', err);
      console.log(errorText || err);
      if (!this.apiKey) console.error('Testomat.io API key is not set');
      if (!this.apiKey?.startsWith('tstmt')) console.error('Testomat.io API key is invalid');

      console.error(
        APP_PREFIX,
        'Error creating Testomat.io report (see details above), please check if your API key is valid. Skipping report',
      );
      printCreateIssue(err);
    }
    debug('"createRun" function finished');
  }

  /**
   * Decides whether to skip test reporting in case of too many request failures
   * @returns {boolean}
   */
  #cancelTestReportingInCaseOfTooManyReqFailures() {
    if (!process.env.TESTOMATIO_MAX_REQUEST_FAILURES) return;

    const cancelReporting = this.requestFailures >= parseInt(process.env.TESTOMATIO_MAX_REQUEST_FAILURES, 10);
    if (cancelReporting) {
      this.reportingCanceledDueToReqFailures = true;
      let errorMessage = `⚠️ ${process.env.TESTOMATIO_MAX_REQUEST_FAILURES}`;
      errorMessage += ' requests were failed, reporting to Testomat aborted.';
      console.warn(`${APP_PREFIX} ${pc.yellow(errorMessage)}`);
    }
    return cancelReporting;
  }

  #uploadSingleTest = async data => {
    if (!this.isEnabled) return;
    if (!this.runId) return;
    if (this.#cancelTestReportingInCaseOfTooManyReqFailures()) return;

    this.#formatData(data);

    const json = JsonCycle.stringify(data);

    debug('Adding test', json);

    return this.client
      .request({
        method: 'POST',
        url: `/api/reporter/${this.runId}/testrun`,
        data: json,
        headers: {
          'Content-Type': 'application/json',
        },
        maxContentLength: Infinity,
      })
      .catch(err => {
        this.requestFailures++;
        this.notReportedTestsCount++;
        if (err.response) {
          if (err.response.status >= 400) {
            const responseData = err.response.data || { message: '' };
            console.log(
              APP_PREFIX,
              pc.yellow(`Warning: ${responseData.message} (${err.response.status})`),
              pc.gray(data?.title || ''),
            );
            if (err.response?.data?.message?.includes('could not be matched')) {
              this.hasUnmatchedTests = true;
            }
            return;
          }
          console.log(
            APP_PREFIX,
            pc.yellow(`Warning: ${data?.title || ''} (${err.response?.status})`),
            `Report couldn't be processed: ${err?.response?.data?.message}`,
          );
          printCreateIssue(err);
        } else {
          console.log(APP_PREFIX, pc.blue(data?.title || ''), "Report couldn't be processed", err);
        }
      });
  };

  /**
   * Uploads tests as a batch (multiple tests at once). Intended to be used with a setInterval
   */
  #batchUpload = async () => {
    if (!this.batch.isEnabled) return;
    if (!this.batch.tests.length) return;
    if (this.#cancelTestReportingInCaseOfTooManyReqFailures()) return;
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

    return this.client
      .request({
        method: 'POST',
        url: `/api/reporter/${this.runId}/testrun`,
        data: {
          api_key: this.apiKey,
          tests: testsToSend,
          batch_index: this.batch.batchIndex,
        },
        headers: {
          'Content-Type': 'application/json',
        },
        maxContentLength: Infinity,
      })
      .catch(err => {
        this.requestFailures++;
        this.notReportedTestsCount += testsToSend.length;
        if (err.response) {
          if (err.response.status >= 400) {
            const responseData = err.response.data || { message: '' };
            console.log(APP_PREFIX, pc.yellow(`Warning: ${responseData.message} (${err.response.status})`));
            if (err.response?.data?.message?.includes('could not be matched')) {
              this.hasUnmatchedTests = true;
            }
            return;
          }
          console.log(
            APP_PREFIX,
            pc.yellow(`Warning: (${err.response?.status})`),
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
    this.isEnabled = !!(this.apiKey ?? this.isEnabled);
    if (!this.isEnabled) return;

    this.runId = this.runId || process.env.runId || this.store.runId || readLatestRunId();
    if (!this.runId) {
      console.warn(APP_PREFIX, pc.red('Run ID is not set, skipping test reporting'));
      return;
    }

    this.#formatData(data);

    let uploading = null;
    if (!this.batch.isEnabled) uploading = this.#uploadSingleTest(data);
    else this.batch.tests.push(data);

    // if test is added after run which is already finished
    if (!this.batch.intervalFunction) uploading = this.#batchUpload();

    // return promise to be able to wait for it
    return uploading;
  }

  /**
   * @param {import('../../types/types.js').RunData} params
   * @returns
   */
  async finishRun(params) {
    if (!this.isEnabled) return;

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
      const errorMessage = pc.red(
        `⚠️ Due to request failures, ${this.notReportedTestsCount} test(s) were not reported to Testomat.io`,
      );
      console.warn(`${APP_PREFIX} ${errorMessage}`);
    }

    const { status } = params;

    let status_event;

    if (status === STATUS.FINISHED) status_event = 'finish';
    if (status === STATUS.PASSED) status_event = 'pass';
    if (status === STATUS.FAILED) status_event = 'fail';

    try {
      if (this.runId && !this.proceed) {
        await this.client.request({
          method: 'PUT',
          url: `/api/reporter/${this.runId}`,
          data: {
            api_key: this.apiKey,
            duration: params.duration,
            status_event,
            detach: params.detach,
            tests: params.tests,
          },
        });

        if (this.runUrl) {
          console.log(APP_PREFIX, '📊 Report Saved. Report URL:', pc.magenta(this.runUrl));
        }
        if (this.runPublicUrl) {
          console.log(APP_PREFIX, '🌟 Public URL:', pc.magenta(this.runPublicUrl));
        }
      }
      if (this.runUrl && this.proceed) {
        const notFinishedMessage = pc.yellow(pc.bold('Run was not finished because of $TESTOMATIO_PROCEED'));
        console.log(APP_PREFIX, `📊 ${notFinishedMessage}. Report URL: ${pc.magenta(this.runUrl)}`);
        console.log(APP_PREFIX, `🛬 Run to finish it: TESTOMATIO_RUN=${this.runId} npx @testomatio/reporter finish`);
      }

      if (this.hasUnmatchedTests) {
        console.log('');
        console.log(APP_PREFIX, pc.yellow(pc.bold('⚠️ Some reported tests were not found in Testomat.io project')));
        console.log(
          APP_PREFIX,
          `If you use Testomat.io as a reporter only, please re-run tests using ${pc.bold('TESTOMATIO_CREATE=1')}`,
        );
        console.log(
          APP_PREFIX,
          `But to keep your tests consistent it is recommended to ${pc.bold('import tests first')}`,
        );
        console.log(APP_PREFIX, 'If tests were imported but still not matched, assign test IDs to your tests.');
        console.log(APP_PREFIX, 'You can do that automatically via command line tools:');
        console.log(APP_PREFIX, pc.bold('npx check-tests ... --update-ids'), 'See: https://bit.ly/js-update-ids');
        console.log(APP_PREFIX, 'or for Cucumber:');
        console.log(APP_PREFIX, pc.bold('npx check-cucumber ... --update-ids'), 'See: https://bit.ly/bdd-update-ids');
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
    );
    console.log(APP_PREFIX, 'Provide this information:');
    console.log('Error:', err.message || err.code);
    if (!err.config) return;

    const time = new Date().toUTCString();
    const { body, url, baseURL, method } = err?.config || {};
    console.log('```js');
    console.log({ body: body?.replace(/"(tstmt_[^"]+)"/g, 'tstmt_*'), url, baseURL, method, time });
    console.log('```');
  });
}

export default TestomatioPipe;
