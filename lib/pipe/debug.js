const fs = require('fs');
const path = require('path');
const os = require('os');
const { APP_PREFIX } = require('../constants');
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
    this.logToFile({ actions: 'store', store: this.store || {} });
    // Bind batchUpload to the instance
    this.batchUpload = this.batchUpload.bind(this);
  }

  #getLogFilePath(timestamp) {
    this.logFileName = path.join(os.tmpdir(), `testomatio.debug.${timestamp}.json`);
    if (!fs.existsSync(this.logFileName)) {
      debug('Creating debug file:', this.logFileName);
      fs.writeFileSync(this.logFileName, '');
      console.log(APP_PREFIX, '🪲. Debug created:');
    }
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

    this.logToFile({ action: 'prepareRun', data: opts });
  }

  async createRun(params = {}) {
    this.batch.isEnabled = params.isBatchEnabled ?? this.batch.isEnabled;
    if (!this.isEnabled) return;
    if (this.batch.isEnabled) this.batch.intervalFunction = setInterval(this.batchUpload, this.batch.intervalTime);

    this.logToFile({ action: 'createRun', params });
  }

  async addTest(data) {
    if (!this.isEnabled) return;

    if (!this.batch.isEnabled) this.logToFile({ action: 'addTest', testId: data });
    else this.batch.tests.push(data);

    if (!this.batch.intervalFunction) await this.batchUpload();
  }

  async batchUpload() {
    this.batch.batchIndex++;
    if (!this.batch.isEnabled) return;
    if (!this.batch.tests.length) return;

    const testsToSend = this.batch.tests.splice(0);

    this.logToFile({ action: 'addTestsBatch', tests: testsToSend });
  }

  async finishRun(params) {
    if (!this.isEnabled) return;
    this.logToFile({ actions: 'finishRun', params });
    await this.batchUpload();
    if (this.batch.intervalFunction) clearInterval(this.batch.intervalFunction);
    console.log(APP_PREFIX, '🪲. Debug Saved to', this.logFileName);
  }

  toString() {
    return 'Debug Reporter';
  }
}

module.exports = DebugPipe;
