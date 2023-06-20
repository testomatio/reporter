const debug = require('debug')('@testomatio/reporter:storage');
const fs = require('fs');
const JestReporter = require('./adapter/jest');
const os = require('os');
const { join } = require('path');
const { TESTOMAT_TMP_STORAGE } = require('./constants');
const path = require('path');
const { fileSystem } = require('./util');

class DataStorage {
  dataType = 'data';

  /**
   * Creates data storage instance for specific data type.
   * Stores data to global variable or to file depending on what is applicable for current test runner.
   * dataType: 'log' | 'artifact' | ...
   * @param {*} dataType storage type (like 'log', 'artifact'); could be any string, used only to define file path
   * @param {*} params
   */
  constructor(dataType, params = {}) {
    if (!dataType) throw new Error('Data type is required when creating data storage');
    this.dataType = dataType;
    this.dataDirName = dataType + 's';
    this.isFileStorage = params?.isFileStorage ?? !global.testomatioDataStore;

    /*
      FYI:
      If this storage instance is used within test runner, it works fine.
      But if, for example, we create storage instance inside the testomatio client (to get stored data),
      the environment could be different (not already a test runner env).
      Thus, checking environment is only reasonable when you put data to starage and potentially useless when get data from storage
    */
    const runningEnvironment = this.getRunningEnviroment();
    if (runningEnvironment === 'jest') this.isFileStorage = true;

    if (this.isFileStorage) {
      this.dataDirPath = path.join(TESTOMAT_TMP_STORAGE.mainDir, this.dataDirName);
      fileSystem.createDir(this.dataDirPath);
    }

    debug(`Data storage mode: ${this.isFileStorage ? 'file' : 'memory'}`);
  }

  // TODO: implement
  getTestIdFromContext(context) {
    // return testId;
  }

  /**
   * Try to define the running environment. Not 100% reliable and used as additional check
   * @returns jest | mocha | ...
   */
  getRunningEnviroment() {
    if (process.env.JEST_WORKER_ID) return 'jest';
    // @ts-expect-error mocha could be undefined, its ok
    if (typeof mocha !== 'undefined') return 'mocha';
    return undefined;
  }

  /**
   * Puts any data to storage (file or global variable)
   * @param {*} data anything you want to store
   * @param {*} context could be testId or any context (test, suite, etc) which is used to define testId
   * @returns
   */
  putData(data, context = null) {
    let testId = null;
    if (typeof context === 'string') {
      testId = context;
    } else {
      // TODO: derive testId from context
      // testId = context...
    }

    // try to get testId for Jest
    testId = testId ?? JestReporter.getIdOfCurrentlyRunningTest();

    // if testId is not provided, data is be saved to `{dataType}_other` file;
    if (!testId) testId = 'other';

    if (this.isFileStorage) {
      this._putDataToFile(data, testId);
    } else {
      this._putDataToGlobalVar(data, testId);
    }
  }

  /**
   * Returns data, stored for specific testId (or data which was stored without test id specified)
   *
   * (Don't try to guess the execution environment (e.g. test runner) inside this method, it could be any)
   * @param {*} context could be testId or any context (test, suite, etc) which is used to define testId
   * @returns
   */
  getData(context) {
    let testId = null;
    if (typeof context === 'string') {
      testId = context;
    } else {
      // TODO: derive testId from context
      // testId = context...
    }

    if (!testId) testId = 'other';

    if (!this.isFileStorage && global?.testomatioDataStore) {
      return this._getDataFromGlobalVar(testId);
    } else {
      return this._getDataFromFile(testId);
    }
  }

  _getDataFromGlobalVar(testId) {
    try {
      if (global?.testomatioDataStore[this.dataDirName]) {
        const testData = global.testomatioDataStore[this.dataDirName][testId];
        debug(`Data for test id ${testId}:\n${testData}`);
        return testData;
      }
      debug(`No ${this.dataType} data for test id ${testId}`);
      return null;
    } catch (e) {
      // there could be no data, ignore
    }
  }

  _getDataFromFile(testId) {
    try {
      const filepath = join(TESTOMAT_TMP_STORAGE.mainDir, `${this.dataType}_${testId}`);
      if (fs.existsSync(filepath)) {
        const testData = fs.readFileSync(filepath, 'utf-8');
        debug(`Data for test id ${testId}:\n${testData}`);
        return testData;
      }
      debug(`No ${this.dataType} data for test id ${testId}`);
      return null;
    } catch (e) {
      // there could be no data, ignore
    }
    return null;
  }

  _putDataToGlobalVar(data, testId) {
    debug('Saving data to global variable for test', testId, ':\n', data, '\n');
    global.testomatioDataStore[this.dataDirName] = {};
    global.testomatioDataStore[this.dataDirName][testId] = data;
  }

  _putDataToFile(data, testId) {
    if (typeof data !== 'string') data = JSON.stringify(data);
    const filename = `${this.dataType}_${testId}`;
    const filepath = join(TESTOMAT_TMP_STORAGE.mainDir, filename);
    debug('Saving data to file for test', testId, 'to', filepath, ':\n', data, '\n');

    // TODO: handle multiple invocations of JSON.stringify. UPD: not actual because decided not to use it - it created extra wrapping quotes "" and // (escaped slashes)
    fs.appendFileSync(filepath, data + os.EOL, 'utf-8');
  }
}

module.exports.DataStorage = DataStorage;

// TODO: consider using fs promises instead of writeSync/appendFileSync to prevent blocking and improve performance (probably queue usage will be required)
// TODO: rewrite client - everything regarding storing artifacts
// TODO: try to define adapter inside client
// TODO: use .env
// TODO: ability to intercept multiple loggers