const debug = require('debug')('@testomatio/reporter:storage');
const { join } = require('path');
const fs = require('fs');
const os = require('os');
const { TESTOMAT_TMP_DIRS } = require('./constants');
const { parseTest } = require('./util');

class DataStorage {
  _dataDirPath = TESTOMAT_TMP_DIRS.common;
  _fileSuffix = '';

  constructor(params = {}) {
    this._isFileStorage = !!params?._isFileStorage ?? global.dataStorage;

    /*
      ATTENTION:
      if this storage instance (or any class instance, inherited from this one) is used within tests, it works fine;
      but if, for example, we create storage instance inside the testomatio client.js (to get stored data), the environment is not already Jest
    */
    this.runningEnvironment = this._getRunningEnviroment();

    if (this.runningEnvironment === 'jest') this._isFileStorage = true;

    debug(`Data storage mode: ${this._isFileStorage ? 'file' : 'memory'}`);

    // this._clearDataDir();
  }

  /**
   * Returns test id
   * @returns test id of currently running Jest test
   */
  _JESTGetCurrentTestId() {
    const currentRunningEnvironment = this._getRunningEnviroment();
    if (currentRunningEnvironment !== 'jest') return null;
    // @ts-expect-error "expect" could only be defined inside Jest environement (forbidden to import it outside)
    const testId = parseTest(expect?.getState()?.currentTestName);
    return testId || null;
  }

  /**
   *
   * @returns jest | mocha ...
   */
  _getRunningEnviroment() {
    if (process.env.JEST_WORKER_ID) return 'jest';
    // @ts-expect-error mocha could be undefined, its ok
    if (typeof mocha !== 'undefined') return 'mocha';
    return undefined;
  }

  put(...args) {
    let context = null;
    // TODO: find ways to define if the last argument is context or not: e.g. check some props presence
    if (args.length > 1 && typeof args[args.length - 1] !== 'string') {
      context = args.pop();
    }
    const logs = args.join(os.EOL);

    // try to get testId for Jest
    let testId = this._JESTGetCurrentTestId() || null;

    // TODO: derive testId from context
    // testId = context...

    // save logs to file; if testId is not provided, it will be saved to "other" file;
    if (!testId) testId = 'other';

    if (Array.isArray(global.store)) {
      debug(`Saving content to global storage for test ${testId}`);
      global.store.push(logs);
    }

    if (!global.store) {
      //! ? TODO:"context.test" is actually context from testing framework, but specificTestInfo expects "context" as test from testomatio client
      // const testId = specificTestInfo(context?.test) || null;

      debug('Saving content to file for test', testId, 'to', this._dataDirPath, ':\n', logs, '\n');

      const filepath = join(this._dataDirPath, `${this._fileSuffix}${testId}`);
      debug('filepath', filepath);

      // TODO: handle multiple invocations of JSON.stringify. UPD: not actual because decided not to use it - it created extra wrapping quotes "" and // (escaped slashes)
      return fs.appendFileSync(filepath, logs + os.EOL, 'utf-8');
    }
  }

  /**
   * Returns data, stored for specific testId (or data which was stored without test if specified)
   * 
   * (Don't try to guess the execution environment (e.g. test runner) inside this method, it could be any)
   * @param {*} testId 
   * @returns 
   */
  getDataForTestId(testId = 'other') {
    try {
      const filepath = join(this._dataDirPath, `${this._fileSuffix}${testId}`);
      const testData = fs.readFileSync(filepath, 'utf-8');
      debug(`Data for test id ${testId}:\n${testData}`);
      return testData;
    } catch (err) {
      console.error('Cannot read data for test', testId, '\n', err);
    }

    return null;

    // TODO: get from memory
    // maybe its reasonable to pass storage type as string (to be sure about it). or try to read from memory first, then from file
  }

  _createDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      debug('Created dir: ', dirPath);
    }
  }

  _clearDataDir() {
    if (fs.existsSync(this._dataDirPath)) {
      fs.rmSync(this._dataDirPath, { recursive: true });
      debug(`Dir ${this._dataDirPath} was deleted`);
    } else {
      debug(`Trying to delete ${this._dataDirPath} but it doesn't exist`);
    }
  }
}

module.exports = new DataStorage();
module.exports.DataStorage = DataStorage;

// TODO: consider using fs promises instead of writeSync/appendFileSync to prevent blocking and improve performance
// probably queue usage will be required

// TODO: clear data dir on start
// TODO: rewrite client - everything regarding storing artifacts
