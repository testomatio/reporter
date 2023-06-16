const debug = require('debug')('@testomatio/reporter:storage');
const { join } = require('path');
const fs = require('fs');
const os = require('os');
const { TESTOMAT_TMP_DIRS } = require('./constants');
const { parseTest } = require('./util');
const { specificTestInfo } = require('./util');

class DataStorage {
  dataDirPath = TESTOMAT_TMP_DIRS.common;
  fileSuffix = '';

  constructor(params = {}) {
    this.isFileStorage = !!params?.isFileStorage;

    // if storage is used withing tests, it works fine;
    // but if, for example, we import it to client (to get and send data), the environment is not already Jest
    this.runningEnvironment = this._getRunningEnviroment();
    if (this.runningEnvironment === 'jest') this.isFileStorage = true;

    debug(`Data storage mode: ${this.isFileStorage ? 'file' : 'memory'}`);

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

  put(content, testId) {
    console.warn(content);
    // TODO: consider context to be testId or test context
    // TODO: parse the last argument as context
    // const context = args.pop();
    // const logs = args;

    // try to get testId for Jest
    testId = testId || this._JESTGetCurrentTestId();
    // save logs to file; if testId is not provided, it will be saved to "other" file;

    if (!testId) testId = 'other';

    if (Array.isArray(global.store)) {
      debug(`Saving content to global storage for test ${testId}`);
      global.store.push(content);
    }

    if (!global.store) {
      //! ? TODO:"context.test" is actually context from testing framework, but specificTestInfo expects "context" as test from testomatio client
      // const testId = specificTestInfo(context?.test) || null;

      debug('Saving content to file for test', testId, 'to', this.dataDirPath, ':\n', content, '\n');

      const filepath = join(this.dataDirPath, `${this.fileSuffix}${testId}`);
      debug('filepath', filepath);

      // TODO: handle multiple invocations of JSON.stringify. UPD: not actual because decided not to use it - it created extra wrapping quotes "" and // (escaped slashes)
      return fs.appendFileSync(filepath, content + os.EOL, 'utf-8');
    }
  }

  _getDataForTestId(testId = 'other') {
      try {
        const filepath = join(this.dataDirPath, `${this.fileSuffix}${testId}`);
        debug('Getting data for test', testId, 'from file', filepath);
        const testData = fs.readFileSync(filepath, 'utf-8');
        debug('Data for test', testId, '\n', testData);
        return testData;
      } catch (err) {
        console.error('Cannot read data for test', testId, '\n', err);
    }

    return null;

    // TODO: get from memory
    // maybe its reasonable to pass storage type as string (to be sure about it)
  }

  _createDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      debug('Created dir: ', dirPath);
    }
  }

  _clearDataDir() {
    if (fs.existsSync(this.dataDirPath)) {
      fs.rmSync(this.dataDirPath, { recursive: true });
      debug(`Dir ${this.dataDirPath} was deleted`);
    } else {
      debug(`Trying to delete ${this.dataDirPath} but it doesn't exist`);
    }
  }
}

module.exports = new DataStorage();
module.exports.DataStorage = DataStorage;

// TODO: consider using fs promises instead of writeSync/appendFileSync to prevent blocking and improve performance

// TODO: clear data dir on start
