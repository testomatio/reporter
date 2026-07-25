import createDebugMessages from 'debug';
import pc from 'picocolors';
import { Gaxios } from 'gaxios';
import JsonCycle from 'json-cycle';
import {
  APP_PREFIX,
  STATUS,
  BATCH_MODE,
  REQUEST_TIMEOUT,
  getCreateRunRequestTimeout,
  REPORTER_REQUEST_RETRIES,
} from '../constants.js';
import {
  isValidUrl,
  foundedTestLog,
  readLatestRunId,
  transformEnvVarToBoolean,
  getGitCommitSha,
} from '../utils/utils.js';
import { parseFilterParams, generateFilterRequestParams, setS3Credentials } from '../utils/pipe_utils.js';
import { config } from '../config.js';
import { log } from '../utils/log.js';

const debug = createDebugMessages('@testomatio/reporter:pipe:testomatio');

if (process.env.TESTOMATIO_RUN) process.env.runId = process.env.TESTOMATIO_RUN;

/**
 * Parse `TESTOMATIO_CI_PARAMS` (comma-separated `key=value` pairs) into an object.
 * Entries without `=` or with empty keys are skipped. Returns undefined when input is empty.
 *
 * @param {string|undefined} raw
 * @returns {Record<string, string>|undefined}
 */
function parseCiParams(raw) {
  if (!raw) return undefined;
  /** @type {Record<string, string>} */
  const result = {};
  for (const entry of raw.split(',')) {
    const idx = entry.indexOf('=');
    if (idx <= 0) continue;
    result[entry.slice(0, idx).trim()] = entry.slice(idx + 1);
  }
  return Object.keys(result).length ? result : undefined;
}

/**
 * @typedef {import('../../types/types.js').Pipe} Pipe
 * @typedef {import('../../types/types.js').TestData} TestData
 * @typedef {import('../../types/types.js').BatchMode} BatchMode
 * @typedef {import('../../types/types.js').CreateRunParams} CreateRunParams
 * @class TestomatioPipe
 * @implements {Pipe}
 */
class TestomatioPipe {
  constructor(params, store) {
    this.batch = {
      /** @type {BatchMode}
       * Batch upload mode:
       * - `auto`: upload tests automatically by time interval (e.g. every 5 seconds).
       * - `manual`: buffer tests and upload only when `sync()` is invoked manually.
       * - `disabled`: send one test per request, no batching.
       */
      mode: params.batchMode || (process.env.TESTOMATIO_DISABLE_BATCH_UPLOAD ? BATCH_MODE.DISABLED : BATCH_MODE.AUTO),
      intervalFunction: null, // will be created in createRun by setInterval function
      intervalTime: 6000, // how often tests are sent
      tests: [], // array of tests in batch
      batchIndex: 0,  // represents the current batch index (starts from 1 and increments by 1 for each batch)
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
    this.sharedRunTimeout = process.env.TESTOMATIO_SHARED_RUN_TIMEOUT
      ? parseInt(process.env.TESTOMATIO_SHARED_RUN_TIMEOUT, 10)
      : undefined;

    if (this.sharedRunTimeout && !this.sharedRun) {
      debug('Auto-enabling sharedRun because sharedRunTimeout is set');
      this.sharedRun = true;
    }

    if (!this.title && (this.sharedRun || this.sharedRunTimeout)) {
      const sha = getGitCommitSha();
      if (sha) {
        this.title = `Shared Run - ${sha}`;
        log.info(`🔄 Auto-generated title for shared run: ${this.title}`);
      } else {
        log.warn(
          pc.red('Failed to resolve git commit SHA for shared run title.'),
          'Please run the tests inside a Git repository or set TESTOMATIO_TITLE explicitly.',
        );
      }
    }
    this.groupTitle = params.groupTitle || process.env.TESTOMATIO_RUNGROUP_TITLE;
    this.env = process.env.TESTOMATIO_ENV;
    this.label = process.env.TESTOMATIO_LABEL;
    this.description = params.description || process.env.TESTOMATIO_DESCRIPTION;

    // Remote CI launch — when `TESTOMATIO_CI_PROFILE` is set the run will be created
    // on the server *and* the named CI profile will be dispatched. Optional
    // `TESTOMATIO_CI_PARAMS` is a comma-separated list of `key=value` pairs
    // forwarded to the CI profile config (e.g. `branch=develop,REGION=eu`).
    this.ciProfile = process.env.TESTOMATIO_CI_PROFILE;
    this.ciParams = parseCiParams(process.env.TESTOMATIO_CI_PARAMS);

    // Create a new instance of gaxios with a custom config
    this.client = new Gaxios({
      baseURL: `${this.url.trim()}`,
      timeout: REQUEST_TIMEOUT,
      proxy: proxy ? proxy.toString() : undefined,
      retry: true,
      retryConfig: {
        retry: REPORTER_REQUEST_RETRIES.retriesPerRequest,
        retryDelay: REPORTER_REQUEST_RETRIES.retryTimeout,
        httpMethodsToRetry: ['GET', 'PUT', 'HEAD', 'OPTIONS', 'DELETE', 'POST'],
        shouldRetry: error => {
          if (!error.response) return false;
          // no need to retry on 4xx errors, because they caused by user mistake, thus retrying will not help
          // 500 could also be related to both user or server mistake, but decided not to retry for now
          // this code code be changed to retry 500 too if needed
          return error.response?.status >= 501; // Retry only on server errors
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
      log.error(pc.red(`Error creating report on Testomat.io, report url '${this.url}' is invalid`));
    }
  }

  /**
   * Prepares data for sending to Testomat.io.
   * @param {*} data - The data to be formatted.
   * @returns
   */
  #formatData(data) {
    data.api_key = this.apiKey;
    if (data.create === undefined) data.create = this.createNewTests;

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

    const clearOptions = parseFilterParams(opts);

    if (!clearOptions) {
      return [];
    }

    const { type, id } = clearOptions;

    try {
      const q = generateFilterRequestParams({
        type,
        id,
        apiKey: this?.apiKey?.trim(),
      });

      if (!q) {
        return [];
      }

      const resp = await this.client.request({
        method: 'GET',
        url: '/api/test_grep',
        ...q,
      });

      if (Array.isArray(resp.data?.tests) && resp.data?.tests?.length > 0) {
        foundedTestLog(APP_PREFIX, resp.data.tests);
        if (this.store) this.store.preparedTestIds = resp.data.tests;
        return resp.data.tests;
      }

      log.warn(`⛔  No tests found for your --filter --> ${type}=${id}`);
    } catch (err) {
      log.error(`🚩 Error getting Testomat.io test grepList: ${err}`);
    }
  }

  /**
   * Creates a new run on Testomat.io
   * @param {CreateRunParams} params
   * @returns Promise<void>
   */
  async createRun(params = {}) {
    if (params.batchMode) this.batch.mode = params.batchMode;
    if (!this.isEnabled) return;
    if (this.batch.mode === BATCH_MODE.AUTO && this.isEnabled)
      this.batch.intervalFunction = setInterval(this.#batchUpload, this.batch.intervalTime);
    if (this.store) {
      this.store.runKind = params.kind;
    }

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

    const coverageConfiguration = this.store?.coverageConfiguration;
    let coverageDescription = null;
    let configuration = null;
    if (coverageConfiguration && (coverageConfiguration.tests?.length || coverageConfiguration.suites?.length)) {
      coverageDescription = this.store?.coverageDescription || null;
      configuration = {
        tests: coverageConfiguration.tests?.map(id => id.replace(/^T/, '')) || [],
        suites: coverageConfiguration.suites?.map(id => id.replace(/^S/, '')) || [],
      };
    }
    // Run description: the user-provided TESTOMATIO_DESCRIPTION with the coverage-derived block
    // (if any) added after it. Neither overrides the other.
    const description = [this.description, coverageDescription].filter(Boolean).join('\n\n') || null;

    // Merge caller-supplied configuration (e.g. { exploratory: true }) into runParams.configuration.
    // Caller values win on key conflict; coverage-derived tests/suites lists are preserved when not overridden.
    if (params.configuration && typeof params.configuration === 'object') {
      configuration = { ...(configuration || {}), ...params.configuration };
      if (this.store) {
        this.store.configuration = { ...(this.store.configuration || {}), ...params.configuration };
      }
    }

    // Assemble the `ci` block when the user asked for a remote CI launch via
    // TESTOMATIO_CI_PROFILE (e.g. `--remote github`). Grep is taken from whatever
    // `--filter` resolution already stashed in the shared pipeStore. When launching
    // an already-prepared run (TESTOMATIO_RUN set) with no fresh filter, ask the
    // server to grep that run's own stored scope via `{ type: 'run', id }`.
    /** @type {{profile: string, grep?: string, type?: string, id?: string, override?: Record<string, any>}|null} */
    let ci = null;
    if (this.ciProfile) {
      ci = { profile: this.ciProfile };
      const grepIds = this.store?.preparedTestIds;
      if (grepIds?.length) {
        ci.grep = grepIds.join('|');
      } else if (this.runId) {
        ci.type = 'run';
        ci.id = this.runId;
      }
      if (this.ciParams) ci.override = this.ciParams;
    }
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
        configuration,
        description,
        ci,
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
        timeout: getCreateRunRequestTimeout(),
        responseType: 'json',
      });
      if (resp.data.artifacts) setS3Credentials(resp.data.artifacts);
      if (resp.data.url) {
        const respUrl = new URL(resp.data.url);
        this.runUrl = `${this.url}${respUrl.pathname}`;
        this.runPublicUrl = resp.data.public_url;
        this.store.runUrl = this.runUrl;
        this.store.runPublicUrl = this.runPublicUrl;
        log.info('📊 Using existing run. Report ID:', this.runId);
        log.info('📊 Report URL:', pc.magenta(this.runUrl));
      }
      return;
    }

    debug('Creating run...');
    try {
      const resp = await this.client.request({
        method: 'POST',
        url: '/api/reporter',
        data: runParams,
        timeout: getCreateRunRequestTimeout(),
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
      log.info('📊 Report created. Report ID:', this.runId);
      process.env.runId = this.runId;
      debug('Run created', this.runId);
    } catch (err) {
      if (!this.apiKey) console.error('Testomat.io API key is not set');
      const errorText = err.response?.data?.message || err.message;
      debug('Error creating run', err);
      console.log(APP_PREFIX, errorText || err);
      if (err.response?.status === 403) this.#disablePipe();

      this.#logFailedResponse(err);

      console.error(
        APP_PREFIX,
        'Error creating Testomat.io report (see details above), please check if your API key is valid. Skipping report',
      );
      printCreateIssue();
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
        if (err.response?.status === 403) this.#disablePipe();
        this.requestFailures++;
        this.notReportedTestsCount++;
        if (err.response) {
          this.#logFailedResponse(err);
          printCreateIssue();
        } else {
          log.info(pc.blue(data?.title || ''), "Report couldn't be processed", err);
        }
      });
  };

  /**
   * Uploads tests as a batch (multiple tests at once). Intended to be used with a setInterval
   */
  #batchUpload = async () => {
    if (this.batch.mode === BATCH_MODE.DISABLED) return;
    if (!this.batch.tests.length) return;
    if (this.#cancelTestReportingInCaseOfTooManyReqFailures()) return;
    // prevent infinite loop
    if (this.batch.numberOfTimesCalledWithoutTests > 10) {
      debug('📨 Batch upload: no tests to send for 10 times, stopping batch');
      clearInterval(this.batch.intervalFunction);
      this.batch.mode = BATCH_MODE.DISABLED;
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
        if (err.response?.status === 403) this.#disablePipe();
        this.requestFailures++;
        this.notReportedTestsCount += testsToSend.length;
        if (err.response) {
          this.#logFailedResponse(err);
          printCreateIssue();
        } else {
          log.info("Report couldn't be processed", err);
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
      log.warn(pc.red('Run ID is not set, skipping test reporting'));
      return;
    }

    this.#formatData(data);

    let uploading = null;
    if (this.batch.mode === BATCH_MODE.DISABLED) uploading = this.#uploadSingleTest(data);
    else this.batch.tests.push(data);

    // auto mode but no interval running yet (e.g. createRun hasn't started it): flush immediately
    if (this.batch.mode === BATCH_MODE.AUTO && !this.batch.intervalFunction) uploading = this.#batchUpload();

    // return promise to be able to wait for it
    return uploading;
  }

  /**
   * Syncs / flushes buffered tests by uploading them as a batch
   * This is used to manually trigger batch upload (e.g., after all tests are added)
   */
  async sync() {
    if (!this.isEnabled) return;
    await this.#batchUpload();
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
      this.batch.mode = BATCH_MODE.DISABLED;
    }

    debug('Finishing run...');

    if (this.reportingCanceledDueToReqFailures) {
      const errorMessage = pc.red(
        `⚠️ Due to request failures, ${this.notReportedTestsCount} test(s) were not reported to Testomat.io`,
      );
      console.warn(`${APP_PREFIX} ${errorMessage}`);
    }

    const { status } = params;

    // a pending run was just created: nothing to update here, only other pipes report it
    if (status === 'pending') return;

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
          log.warn('📊 Report URL:', pc.magenta(this.runUrl));
        }
        if (this.runPublicUrl) {
          log.info('🌟 Public URL:', pc.magenta(this.runPublicUrl));
        }
      }
      if (this.runUrl && this.proceed) {
        const notFinishedMessage = pc.yellow(pc.bold('Run was not finished because of $TESTOMATIO_PROCEED'));
        log.warn(`📊 ${notFinishedMessage}. Report URL: ${pc.magenta(this.runUrl)}`);
        log.warn(`🛬 Run to finish it: TESTOMATIO_RUN=${this.runId} npx @testomatio/reporter finish`);
      }

      if (this.hasUnmatchedTests) {
        console.log('');
        log.warn(pc.yellow(pc.bold('⚠️ Some reported tests were not found in Testomat.io project')));
        console.log(
          APP_PREFIX,
          `If you use Testomat.io as a reporter only, please re-run tests using ${pc.bold('TESTOMATIO_CREATE=1')}`,
        );
        console.log(
          APP_PREFIX,
          `But to keep your tests consistent it is recommended to ${pc.bold('import tests first')}`,
        );
        log.info(
          'If tests were imported but still not matched, assign test IDs to your tests.',
          'You can do that automatically via command line tools:',
          pc.bold('npx check-tests ... --update-ids'),
          'See: https://bit.ly/js-update-ids',
          'or for Cucumber:',
          pc.bold('npx check-cucumber ... --update-ids'),
          'See: https://bit.ly/bdd-update-ids',
        );
      }
    } catch (err) {
      console.log(APP_PREFIX, 'Error updating status, skipping...', err);
      this.#logFailedResponse(err);
      printCreateIssue();
    }
    debug('Run finished');
  }

  #disablePipe() {
    this.isEnabled = false;
    this.apiKey = null;

    // clear interval function, otherwise the proccess will continue indefinitely
    if (this.batch.intervalFunction) {
      clearInterval(this.batch.intervalFunction);
      this.batch.intervalFunction = null;
      this.batch.mode = BATCH_MODE.DISABLED;
    }
    this.batch.tests = [];
  }

  #logFailedResponse(error) {
    let responseBody = stringify(error.response?.data ?? error.response ?? error, { pretty: true });
    if (!responseBody) responseBody = '<empty>';
    responseBody = hideTestomatioToken(responseBody);

    const statusCode = error.status || error.code || error.response?.status || '<unknown status code>';
    const method = error.response?.config?.method || '<unknown method>';
    const url = String(error.response?.config?.url || '<unknown url>');
    const statusText = error.response?.statusText || '';

    let message = pc.yellow('⚠️ Request to Testomat.io failed:\n');
    message += pc.bold(`${pc.red(statusCode)} ${method} ${pc.gray(url)}\n`);

    const apiMessage = error.response?.data?.message;
    if (statusCode === 403) {
      message += `\t${pc.red('Please check your API token. It might be invalid or expired.')}\n`;
    } else if (apiMessage) {
      message += `\t${pc.red(apiMessage)}\n`;
    } else if (statusText) {
      message += `\t${pc.red(statusText)}\n`;
    }

    message += `\t${pc.bold('response: ')}${pc.gray(responseBody)}\n`;

    const requestBody = hideTestomatioToken(stringify(error.response?.config?.data));
    if (process.env.DEBUG || process.env.TESTOMATIO_DEBUG || requestBody.length < 1000) {
      // full body
      message += `\t${pc.bold('request: ')}${pc.gray(requestBody)}\n`;
    } else {
      // cut body
      const requestBodyCut = requestBody.slice(0, 1000);
      message += `\t${pc.bold('request: ')}${pc.gray(`${requestBodyCut}...`)}\n`;
      message += '\trequest body is cut, run with TESTOMATIO_DEBUG=1 to see full body\n';
    }

    console.log(message);

    if (error.response?.data?.message?.includes('could not be matched')) {
      this.hasUnmatchedTests = true;
    }
  }

  toString() {
    return 'Testomatio Reporter';
  }
}

let registeredErrorHints = false;
function printCreateIssue() {
  if (registeredErrorHints) return;
  registeredErrorHints = true;
  process.on('exit', () => {
    console.log(
      APP_PREFIX,
      'There was an error reporting to Testomat.io.\n',
      pc.yellow(
        'If you think this is a bug please create an issue: https://github.com/testomatio/reporter/issues/new.',
      ),
      pc.yellow('Provide the logs from above'),
    );
  });
}

/**
 * Removes Testomatio token from string data
 *
 * @param {string} data
 * @returns {string}
 */
function hideTestomatioToken(data) {
  return (typeof data === 'string' ? data : '')
    .replace(/"api_key"\s*:\s*"[^"]+"/g, '"api_key": "<hidden>"')
    .replace(/"(tstmt_[^"]+)"/g, '"tstmt_***"');
}

/**
 * Stringifies provided data
 *
 * @param {any} anything
 * @param {{ pretty: boolean }} opts
 * @returns {string}
 */
function stringify(anything, opts = { pretty: false }) {
  return typeof anything === 'string' ? anything : JSON.stringify(anything, null, opts.pretty ? 2 : undefined);
}

export default TestomatioPipe;
