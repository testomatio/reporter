const fs = require('fs');
const path = require('path');
const os = require('os');
const { APP_PREFIX } = require('../constants');
const debug = require('debug')('@testomatio/reporter:pipe:debug');
// upgrade to latest for ESM
const prettyMs = require('pretty-ms');

class DebugPipe {
  constructor(params, store) {
    this.isEnabled = !!process.env.TESTOMATIO_DEBUG || !!process.env.DEBUG;
    if (this.isEnabled) {
      this.batch = {
        isEnabled: params.isBatchEnabled ?? !process.env.TESTOMATIO_DISABLE_BATCH_UPLOAD ?? true,
        intervalFunction: null,
        intervalTime: 5000,
        tests: [],
        batchIndex: 0,
      };
      this.logFilePath = path.join(os.tmpdir(), `testomatio.debug.${Date.now()}.json`);
      this.store = store || {};

      debug('Creating debug file:', this.logFilePath);
      fs.writeFileSync(this.logFilePath, '');
      console.log(APP_PREFIX, '🪲. Debug created:');
      this.testomatioEnvVars = Object.keys(process.env)
        .filter(key => key.startsWith('TESTOMATIO_'))
        .reduce((acc, key) => {
          acc[key] = process.env[key];
          return acc;
        }, {});
      this.logToFile({ datetime: new Date().toISOString(), timestamp: Date.now() });
      this.logToFile({ data: 'variables', testomatioEnvVars: this.testomatioEnvVars });
      this.logToFile({ data: 'store', store: this.store || {} });
      // Bind batchUpload to the instance
      this.batchUpload = this.batchUpload.bind(this);
    }
  }

  /**
   * Logs data to a file if logging is enabled.
   *
   * @param {Object} logData - The data to be logged.
   * @returns {Promise<void>} A promise that resolves when the log data has been appended to the file.
   */
  logToFile(logData) {
    if (!this.isEnabled) return;
    const timePassedFromLastAction = Date.now() - (this.lastActionTimestamp || Date.now());
    this.lastActionTimestamp = Date.now();

    const logLine = JSON.stringify({ t: `+${prettyMs(timePassedFromLastAction)}`, ...logData });
    fs.appendFileSync(this.logFilePath, `${logLine}\n`);
  }

  async prepareRun(opts) {
    if (!this.isEnabled) return [];

    this.logToFile({ action: 'prepareRun', data: opts });
  }

  async createRun(params = {}) {
    if (!this.isEnabled) return;
    if (params.isBatchEnabled === true || params.isBatchEnabled === false) this.batch.isEnabled = params.isBatchEnabled;

    if (!this.isEnabled) return {};
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
    console.log(APP_PREFIX, '🪲. Debug Saved to', this.logFilePath);
  }

  toString() {
    return 'Debug Reporter';
  }
}

module.exports = DebugPipe;
