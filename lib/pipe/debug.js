const fs = require('fs');
const path = require('path');
const os = require('os');
const { APP_PREFIX, STATUS } = require('../constants');
const debug = require('debug')('@testomatio/reporter:pipe:debug');

class DebugPipe {
  constructor(params, store) {
    this.isEnabled = !!process.env.TESTOMATIO_DEBUG;
    if (!this.isEnabled) return;

    this.batch = {
      isEnabled: params.isBatchEnabled ?? !process.env.TESTOMATIO_DISABLE_BATCH_UPLOAD ?? true,
      intervalFunction: null,
      intervalTime: 5000,
      tests: [],
      batchIndex: 0,
    };
    this.logFileName = '';
    this.store = store || {};
    this.timestamp = Date.now();

    this.#getLogFilePath(this.timestamp);
    this.testomatioEnvVars = Object.keys(process.env)
      .filter(key => key.startsWith('TESTOMATIO_'))
      .reduce((acc, key) => {
        acc[key] = process.env[key];
        return acc;
      }, {});
    this.logToFile({ actions: 'preconditions', testomatioEnvVars: this.testomatioEnvVars });
    this.logToFile({ actions: 'params', params });
    this.logToFile({ actions: 'store', store });
  }

  #getLogFilePath(timestamp) {
    const tempFilePath = path.join(os.tmpdir(), `testomatio.debug.${timestamp}.json`);
    this.logFileName = tempFilePath;
    if (!fs.existsSync(tempFilePath)) {
      debug('Creating debug file:', tempFilePath);
      fs.writeFileSync(tempFilePath, '');
      console.log(APP_PREFIX, '🪲. Debug created:');
    }
    return tempFilePath;
  }

  /**
   * Logs data to a file if logging is enabled.
   *
   * @param {Object} logData - The data to be logged.
   * @returns {void}
   */
  logToFile(logData) {
    if (!this.isEnabled) return;
    const logLine = JSON.stringify(logData);
    fs.promises.appendFile(this.logFileName, `${logLine}\n`).catch(err => {
      console.error('Error writing log to file:', err);
    });
  }

  async prepareRun(opts) {
    if (!this.isEnabled) return [];

    this.logToFile({ action: 'prepare_run_finished', data: opts });
  }

  async createRun(params = {}) {
    if (this.batch) {
      this.batch.isEnabled = params.isBatchEnabled ?? this.batch.isEnabled;
    }
    if (!this.isEnabled) return;

    this.logToFile({ action: 'create_run_params', params });
  }

  async addTest(data) {
    if (!this.isEnabled) return;

    if (!this.batch.isEnabled) await this.logSingleTest(data);
    else this.batch.tests.push(data);

    if (!this.batch.intervalFunction) await this.batchUpload();

    this.logToFile({ action: 'addTest_finished', testId: data.testId });
  }

  async logSingleTest(data) {
    try {
      this.logToFile({ action: 'addTest_started', testId: data.testId });

      if (!process.env.TESTOMATIO_STACK_PASSED && data.status === STATUS.PASSED) {
        data.stack = null;
      }
      this.logToFile({ action: 'addTest_finished', testId: data.testId });
    } catch (err) {
      this.logToFile({
        status: 'addTest_failed',
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

    this.logToFile({ action: 'add_tests_batch', tests: testsToSend });
  }

  async finishRun(params) {
    if (!this.isEnabled) return;

    await this.batchUpload();
    if (this.batch.intervalFunction) clearInterval(this.batch.intervalFunction);

    this.logToFile({ action: 'finish_run', params });
    console.log(APP_PREFIX, '🪲. Debug Saved to', this.logFileName);
  }

  toString() {
    return 'Debug Reporter';
  }
}

module.exports = DebugPipe;
