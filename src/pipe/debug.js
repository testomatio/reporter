import fs from 'fs';
import path from 'path';
import os from 'os';
import createDebugMessages from 'debug';
import { APP_PREFIX } from '../constants.js';
import prettyMs from 'pretty-ms';

const debug = createDebugMessages('@testomatio/reporter:pipe:debug');

export class DebugPipe {
  constructor(params, store) {
    this.params = params || {};
    this.store = store || {};

    this.isEnabled = !!process.env.TESTOMATIO_DEBUG || !!process.env.DEBUG;
    if (this.isEnabled) {
      this.batch = {
        isEnabled: this.params.isBatchEnabled ?? !process.env.TESTOMATIO_DISABLE_BATCH_UPLOAD ?? true,
        intervalFunction: null,
        intervalTime: 5000,
        tests: [],
        batchIndex: 0,
      };
      this.logFilePath = path.join(os.tmpdir(), `testomatio.debug.${Date.now()}.json`);

      debug('Creating debug file:', this.logFilePath);
      fs.writeFileSync(this.logFilePath, '');

      // Create symlink to ensure consistent path to latest debug file
      const symlinkPath = path.join(os.tmpdir(), 'testomatio.debug.latest.json');
      try {
        // Remove existing symlink if it exists
        if (fs.existsSync(symlinkPath)) {
          fs.unlinkSync(symlinkPath);
        }
        // Create new symlink pointing to the timestamped debug file
        fs.symlinkSync(this.logFilePath, symlinkPath);
        debug('Created symlink:', symlinkPath, '->', this.logFilePath);
      } catch (err) {
        debug('Failed to create symlink:', err.message);
      }

      console.log(APP_PREFIX, '🪲 Debug file created');
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

    if (!this.batch.isEnabled) {
      const logData = { action: 'addTest', testId: data };
      if (this.store.runId) logData.runId = this.store.runId;
      this.logToFile(logData);
    } else this.batch.tests.push(data);

    if (!this.batch.intervalFunction) await this.batchUpload();
  }

  async batchUpload() {
    this.batch.batchIndex++;
    if (!this.batch.isEnabled) return;
    if (!this.batch.tests.length) return;

    const testsToSend = this.batch.tests.splice(0);

    const logData = { action: 'addTestsBatch', tests: testsToSend };
    if (this.store.runId) logData.runId = this.store.runId;
    this.logToFile(logData);
  }

  async finishRun(params) {
    if (!this.isEnabled) return;
    await this.batchUpload();
    if (this.batch.intervalFunction) clearInterval(this.batch.intervalFunction);
    this.logToFile({ action: 'finishRun', params });
    console.log(APP_PREFIX, '🪲 Debug Saved to', this.logFilePath);
  }

  toString() {
    return 'Debug Reporter';
  }
}
