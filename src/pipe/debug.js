import fs from 'fs';
import path from 'path';
import createDebugMessages from 'debug';
import prettyMs from 'pretty-ms';
import { log } from '../utils/log.js';
import { getDebugFilePath } from '../utils/debug.js';

const debug = createDebugMessages('@testomatio/reporter:pipe:debug');

export class DebugPipe {
  constructor(params, store) {
    this.params = params || {};
    this.store = store || {};

    this.isEnabled = !!process.env.TESTOMATIO_DEBUG || !!process.env.DEBUG;
    if (this.isEnabled) {
      this.tests = [];
      const suffix = process.env.TESTOMATIO_REPLAY ? 'replay' : '';
      const paths = getDebugFilePath(suffix);
      this.logFilePath = paths.tmp;
      this.rootPath = paths.root;
      this.historyDir = path.dirname(paths.tmp);

      debug('Creating debug file:', this.logFilePath);
      fs.writeFileSync(this.logFilePath, '');

      // Create symlink in project root pointing to the timestamped debug file.
      // Symlinks may fail on Windows without admin / on filesystems that don't support them;
      // fall back to printing the actual tmp path so the user-facing log isn't misleading.
      try {
        // Use lstatSync (not existsSync) so we also detect dangling symlinks —
        // existsSync follows links and returns false when the target is gone,
        // which would leave a stale symlink in place and make symlinkSync fail with EEXIST.
        try {
          fs.lstatSync(paths.root);
          fs.unlinkSync(paths.root);
        } catch (e) {
          if (e.code !== 'ENOENT') throw e;
        }
        fs.symlinkSync(this.logFilePath, paths.root);
        debug('Created symlink:', paths.root, '->', this.logFilePath);
      } catch (err) {
        debug('Failed to create symlink, using tmp path directly:', err.message);
        this.rootPath = this.logFilePath;
      }

      log.info('🪲 Debug file created');
      this.testomatioEnvVars = Object.keys(process.env)
        .filter(key => key.startsWith('TESTOMATIO_'))
        .reduce((acc, key) => {
          acc[key] = process.env[key];
          return acc;
        }, {});
      this.logToFile({ datetime: new Date().toISOString(), timestamp: Date.now() });
      this.logToFile({ data: 'variables', testomatioEnvVars: this.testomatioEnvVars });
      this.logToFile({ data: 'store', store: this.store || {} });
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

    this.logToFile({ action: 'createRun', params });
  }

  async addTest(data) {
    if (!this.isEnabled) return;
    this.tests.push(data);
  }

  async finishRun(params) {
    if (!this.isEnabled) return;
    await this.sync();
    const logData = { action: 'finishRun', params };
    if (this.store.runId) logData.runId = this.store.runId;
    this.logToFile(logData);

    log.info(`🪲 Debug file: ${this.rootPath}`);
    log.info(`History: ${this.historyDir}`);
  }

  async sync() {
    if (!this.isEnabled || !this.tests.length) return;

    const tests = this.tests.splice(0);
    const logData = { action: 'addTestsBatch', tests };
    if (this.store.runId) logData.runId = this.store.runId;
    this.logToFile(logData);
  }

  toString() {
    return 'Debug Reporter';
  }
}
