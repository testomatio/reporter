const debug = require('debug')('@testomatio/reporter:storage');
const fs = require('fs');
const JestReporter = require('./adapter/jest');
const os = require('os');
const { join } = require('path');
const { TESTOMAT_TMP_STORAGE } = require('./constants');

// TODO: try to define adapter inside client
// TODO: use .env
// TODO: addability to intercept multiple loggers

class DataStorage {
  _fileSuffix = '';

  /**
   *
   * @param {*} params:
   * client: 'logger' | 'artifactStorage'
   * @returns
   */
  constructor(params = {}) {
    // switch (params.client) {
    //   case 'logger':
    //     this._fileSuffix = 'log_';
    //     break;
    //   case 'artifactStorage':
    //     this._fileSuffix = 'artifact_';
    //     break;
    //   default:
    //     break;
    // }

    // could not be singletone, causes error
    if (!DataStorage.instance) {
      // DataStorage.instance = this;
      // example of setting prop from params for singleton
      // DataStorage.instance._isFileStorage = !!params?._isFileStorage ?? global.dataStorage;
    } else {
      // this._isFileStorage = !!params?._isFileStorage ?? global.dataStorage;
    }

    /*
      ATTENTION:
      If this storage instance is used within tests, it works fine.
      But if, for example, we create storage instance inside the testomatio client (to get stored data),
      the environment could be different (not already a test runner env).
      Thus, checking environment is only reasonable when you put data to starage and potentially useless when get data from storage
    */
    const runningEnvironment = this._getRunningEnviroment();
    if (runningEnvironment === 'jest') this._isFileStorage = true;

    debug(`Data storage mode: ${this._isFileStorage ? 'file' : 'memory'}`);

    return DataStorage.instance;
  }

  // TODO: implement
  getTestIdFromContext(context) {
    // return testId;
  }

  /**
   *
   * @returns jest | mocha | ...
   */
  _getRunningEnviroment() {
    if (process.env.JEST_WORKER_ID) return 'jest';
    // @ts-expect-error mocha could be undefined, its ok
    if (typeof mocha !== 'undefined') return 'mocha';
    return undefined;
  }

  // TODO: make 1 argument
  // TODO: stringify data if not string (e.g. {}, or [])
  putData(data, context = null) {
    let testId = null;
    // let context = null;
    if (typeof context === 'string') {
      testId = context;
    } else {
      // TODO: get testId from context
    }

    // try to get testId for Jest
    testId = testId ?? JestReporter.getIdOfCurrentlyRunningTest();

    // TODO: derive testId from context
    // testId = context...

    // save logs to file; if testId is not provided, it will be saved to "other" file;
    if (!testId) testId = 'other';

    if (Array.isArray(global.store)) {
      debug(`Saving content to global storage for test ${testId}`);
      global.store.push(data);
    }

    // TODO: rename store to smth specific; use symbol
    if (!global.store) {
      //! ? TODO:"context.test" is actually context from testing framework, but specificTestInfo expects "context" as test from testomatio client
      // const testId = specificTestInfo(context?.test) || null;

      debug('Saving content to file for test', testId, 'to', TESTOMAT_TMP_STORAGE.mainDir, ':\n', data, '\n');

      const filepath = join(TESTOMAT_TMP_STORAGE.mainDir, `${this._fileSuffix}${testId}`);
      debug('filepath', filepath);

      // TODO: handle multiple invocations of JSON.stringify. UPD: not actual because decided not to use it - it created extra wrapping quotes "" and // (escaped slashes)
      return fs.appendFileSync(filepath, data + os.EOL, 'utf-8');
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
      const filepath = join(TESTOMAT_TMP_STORAGE.mainDir, `${this._fileSuffix}${testId}`);
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

  // TODO: transfer logic to util
  _createDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      debug('Created dir: ', dirPath);
    }
  }

  // TODO: transfer logic to util
  _clearDataDir() {
    if (fs.existsSync(TESTOMAT_TMP_STORAGE.mainDir)) {
      fs.rmSync(TESTOMAT_TMP_STORAGE.mainDir, { recursive: true });
      debug(`Dir ${TESTOMAT_TMP_STORAGE.mainDir} was deleted`);
    } else {
      debug(`Trying to delete ${TESTOMAT_TMP_STORAGE.main} but it doesn't exist`);
    }
  }
}

DataStorage.instance = null;

module.exports = new DataStorage();
module.exports.DataStorage = DataStorage;

// TODO: consider using fs promises instead of writeSync/appendFileSync to prevent blocking and improve performance
// probably queue usage will be required

// TODO: clear data dir on start
// TODO: rewrite client - everything regarding storing artifacts
