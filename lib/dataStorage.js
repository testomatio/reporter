const debug = require('debug')('@testomatio/reporter:storage');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { join } = require('path');
const JestReporter = require('./adapter/jest');
const { TESTOMAT_TMP_STORAGE } = require('./constants');
const { fileSystem } = require('./util');
const getTestIdFromTestTitle = require('./util').parseTest;

class DataStorage {
  /**
   * Creates data storage instance for specific data type.
   * Stores data to global variable or to file depending on what is applicable for current test runner.
   * dataType: 'log' | 'artifact' | ...
   * @param {*} dataType storage type (like 'log', 'artifact'); could be any string, used only to define file path
   */
  constructor(dataType) {
    // if (!dataType) throw new Error('Data type is required when creating data storage');
    this.dataType = dataType || 'data';
    this.dataDirName = this.dataType;

    this._refreshStorageType();

    // dir is created in any case (not to recheck its existence every time)
    this.dataDirPath = path.join(TESTOMAT_TMP_STORAGE.mainDir, this.dataDirName);
    fileSystem.createDir(this.dataDirPath);

    debug(`Data storage mode: ${this.isFileStorage ? 'file' : 'memory'}`);
  }

  /**
   * Try to define the running environment. Not 100% reliable and used as additional check
   * @returns jest | mocha | ...
   */
  getRunningEnviroment() {
    // jest
    if (process.env.JEST_WORKER_ID) return 'jest';

    // mocha
    try {
      // @ts-expect-error mocha is defined only in mocha environment
      if (typeof mocha !== 'undefined') return 'mocha';
    } catch (e) {
      // ignore
    }

    // codeceptjs
    // @ts-expect-error codeceptjs is defined only in codeceptjs environment
    if (global.codeceptjs) return 'codeceptjs';

    // others
    // 'cucumber:current', 'cucumber:legacy'
    if (global.testomatioRunningEnvironment) return global.testomatioRunningEnvironment;

    if (process.env.PLAYWRIGHT_TEST_BASE_URL) return 'playwright';

    return null;
  }

  /**
   * Puts any data to storage (file or global variable)
   * @param {*} data anything you want to store
   * @param {*} context could be testId or any context (test, suite, etc) which is used to define testId
   * @returns
   */
  putData(data, context = null) {
    this._refreshStorageType();

    let testId = this._tryToRetrieveTestId(context) || null;

    if (this.runningEnvironment === 'codeceptjs') testId = testId ?? global.testomatioDataStore?.currentlyRunningTestId;
    if (this.runningEnvironment === 'jest') testId = testId ?? JestReporter.getIdOfCurrentlyRunningTest();
    // logs in playwright are gathered by pw framwork itself
    if (this.runningEnvironment === 'playwright' && this.dataType === 'log') return;

    // get id from global store
    if (global.testomatioDataStore && global.testomatioDataStore.currentlyRunningTestId)
      testId = testId ?? global.testomatioDataStore?.currentlyRunningTestId;

    // if testId is not provided, data is be saved to `{dataType}_other` file;
    if (!testId) {
      debug(`No test id provided for ${this.dataType} data: ${data}`);
      return;
    }

    if (this.isFileStorage) {
      this._putDataToFile(data, testId);
    } else {
      this._putDataToGlobalVar(data, testId);
    }
  }

  /**
   * Returns data, stored for specific testId (or data which was stored without test id specified).
   * This method will get data from global variable. But if it is not available, it will try to get data from file.
   * Thus, good approach is to remove file storage folder before each test run (and after, for sure).
   *
   * Defining the execution environment is not guaranteed! Is used only as additional check.
   * @param {*} context could be testId or any context (test, suite, etc) which is used to define testId
   * @returns
   */
  getData(context) {
    this._refreshStorageType();

    let testId = null;
    if (typeof context === 'string') {
      testId = context;
    } else {
      // TODO: derive testId from context
      // testId = context...
    }

    if (!testId) {
      debug(`Cannot get test id from passed context:\n}`, context);
      return null;
    }

    let testData = null;

    if (global?.testomatioDataStore) {
      testData = this._getDataFromGlobalVar(testId);
      if (testData) return testData;
    }

    if (this.isFileStorage || !testData) {
      testData = this._getDataFromFile(testId);
      if (testData) return testData;
    }

    debug(`No ${this.dataType} data for test id ${testId} in both file and global variable`);
    return testData;
  }

  /**
   * This method is named as "try" because it does not guarantee that test id could be retrieved.
   * Context could be anything (test, suite, string, etc) which is used to define testId.
   * Or it could represent any other entity (which does not contain test id).
   * @param {*} context
   */
  _tryToRetrieveTestId(context) {
    if (!context) return null;
    this._refreshStorageType();

    if (this.runningEnvironment === 'playwright' || context?.title) {
      // context is testInfo
      const testId = getTestIdFromTestTitle(context.title);
      if (testId) return testId;
    }

    if (typeof context === 'string') {
      const testId = getTestIdFromTestTitle(context);
      if (testId) return testId;
    }

    return null;
  }

  /**
   * Refreshes storage type (file or global variable) depending on current environment
   * This method should be run on each attempt to put or get data from/to storage
   * Because storage instance is created before the test runner is started. And storage type could be changed
   */
  _refreshStorageType() {
    this.isFileStorage = !global.testomatioDataStore;
    /*
        FYI:
        If this storage instance is used within test runner, it works fine.
        But if, for example, we create storage instance inside the testomatio client (to get stored data),
        the environment could differs (not already a test runner environment).
        Thus, checking environment is only reasonable when you put data to starage
        (to define where to put data - to global variable or to file)
        and potentially useless when getting data from storage
      */
    this.runningEnvironment = this.getRunningEnviroment();

    // some test frameworks do not persist global variables, thus file storage is used for them
    if (this.runningEnvironment === 'jest') this.isFileStorage = true;
  }

  _getDataFromGlobalVar(testId) {
    try {
      if (global?.testomatioDataStore[this.dataDirName]) {
        const testData = global.testomatioDataStore[this.dataDirName][testId];
        debug(`Data for test id ${testId}:\n${testData}`);
        return testData;
      }
      debug(`No ${this.dataType} data for test id ${testId} in <global> storage`);
      return null;
    } catch (e) {
      // there could be no data, ignore
    }
  }

  _getDataFromFile(testId) {
    try {
      const filepath = join(this.dataDirPath, `${this.dataType}_${testId}`);
      if (fs.existsSync(filepath)) {
        const testData = fs.readFileSync(filepath, 'utf-8');
        debug(`Data for test id ${testId}:\n${testData}`);
        return testData;
      }
      debug(`No ${this.dataType} data for test id ${testId} in <file> storage`);
      return null;
    } catch (e) {
      // there could be no data, ignore
    }
    return null;
  }

  _putDataToGlobalVar(data, testId) {
    debug('Saving data to global variable for test', testId, ':\n', data, '\n');
    if (!global.testomatioDataStore[this.dataDirName]) global.testomatioDataStore[this.dataDirName] = {};
    global.testomatioDataStore[this.dataDirName][testId] // eslint-disable-line no-unused-expressions
      ? (global.testomatioDataStore[this.dataDirName][testId] += `\n${data}`)
      : (global.testomatioDataStore[this.dataDirName][testId] = data);
  }

  _putDataToFile(data, testId) {
    if (typeof data !== 'string') data = JSON.stringify(data);
    const filename = `${this.dataType}_${testId}`;
    const filepath = join(this.dataDirPath, filename);
    debug('Saving data to file for test', testId, 'to', filepath, ':\n', data, '\n');

    // TODO: handle multiple invocations of JSON.stringify.
    // UPD: not actual because decided not to use it - it created extra wrapping quotes "" and // (escaped slashes)
    fs.appendFileSync(filepath, data + os.EOL, 'utf-8');
  }
}

module.exports.DataStorage = DataStorage;

// TODO: consider using fs promises instead of writeSync/appendFileSync to
// prevent blocking and improve performance (probably queue usage will be required)

// TODO: rewrite client - everything regarding storing artifacts
// TODO: try to define adapter inside client
// TODO: use .env
// TODO: ability to intercept multiple loggers (upd: no need)


/* Cypress
Parallelization is only available if using Cypress Dashboard??
*/
