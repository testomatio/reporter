const debug = require('debug')('@testomatio/reporter:storage');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { join } = require('path');
const { TESTOMAT_TMP_STORAGE_DIR } = require('../constants');
const { fileSystem, jestHelpers, parseTest } = require('../utils/utils');

const getTestIdFromTestTitle = parseTest;

class DataStorage {
  /**
   * Creates data storage instance for specific data type.
   * Stores data to global variable or to file depending on what is applicable for current test runner
   * (running environment).
   * Recommend to use composition while using this class (instead of inheritance).
   * ! Also the class which will use data storage should be singleton (to avoid data loss).
   * @param {*} dataType storage type (like 'log', 'artifact'); could be any string, used only to define file path
   */
  constructor(dataType) {
    this.dataType = dataType || 'data';
    this.isFileStorage = true;
    this.#refreshStorageType();

    this.dataDirPath = path.join(TESTOMAT_TMP_STORAGE_DIR, this.dataType);

    // set test title for mocha (could not be moved to adapter)
    // it does not override existing hook, just add new one
    try {
      // @ts-ignore
      if (!beforeEach) return;
      // @ts-ignore-next-line
      beforeEach(function () {
        if (this.currentTest?.__mocha_id__) {
          global.testTitle = this.currentTest.fullTitle();
        }
      });
    } catch (e) {
      // ignore
    }

    // set test title for playwright
    try {
      // eslint-disable-next-line import/no-extraneous-dependencies, import/no-unresolved
      const { test } = require('@playwright/test');
      // eslint-disable-next-line no-empty-pattern
      test.beforeEach(async ({}, testInfo) => {
        global.testTitle = testInfo.title;
        global.testomatioRunningEnvironment = 'playwright';
      });
    } catch (e) {
      // ignore
    }
  }

  /**
   * Try to define the running environment. Not 100% reliable and used as additional check
   * @returns jest | mocha | ...
   */
  getRunningEnviroment() {
    // jest
    if (process.env.JEST_WORKER_ID) return 'jest';

    if (global.codeceptjs) return 'codeceptjs';

    // 'cucumber:current', 'cucumber:legacy'
    if (global.testomatioRunningEnvironment) return global.testomatioRunningEnvironment;

    if (process.env.PLAYWRIGHT_TEST_BASE_URL || process.env.TEST_WORKER_INDEX) return 'playwright';

    // mocha - can't detect
    return null;
  }

  /**
   * Puts any data to storage (file or global variable).
   * If file: stores data as text, if global variable – stores as array of data.
   * @param {*} data anything you want to store (string, object, array, etc)
   * @param {*} context could be testId or any context (test, suite, etc) which is used to define testId
   * @returns
   */
  putData(data, context = null) {
    fileSystem.createDir(this.dataDirPath);

    this.#refreshStorageType();
    context = context ?? global.testTitle ?? null;
    let testId = this.#tryToRetrieveTestId(context) || context || null;

    if (this.runningEnvironment === 'codeceptjs') {
      this.isFileStorage = false;
      testId = testId ?? global.testomatioDataStore?.currentlyRunningTestId;
    }

    if (this.runningEnvironment === 'jest') {
      testId = testId ?? jestHelpers.getIdOfCurrentlyRunningTest();
    }

    // logs in playwright are gathered by pw framework itself
    if (this.runningEnvironment === 'playwright' && this.dataType === 'log') return;

    // get id from global store
    if (global.testomatioDataStore && global.testomatioDataStore.currentlyRunningTestId)
      testId = testId ?? global.testomatioDataStore?.currentlyRunningTestId;

    if (!testId && global?.currentlyRunningTestTitle)
      testId = this.#tryToRetrieveTestId(global.currentlyRunningTestTitle);

    if (!testId) {
      debug(`No test id provided for "${this.dataType}" data:`, data);
      return;
    }

    if (this.isFileStorage) {
      this.#putDataToFile(data, testId);
    } else {
      this.#putDataToGlobalVar(data, testId);
    }
  }

  /**
   * Returns data, stored for specific testId (or data which was stored without test id specified).
   * This method will get data from global variable and/or from from file (previosly saved with put method).
   *
   * @param {*} context could be testId or any context (test title, suite, etc) which is used to define testId
   * @returns array of data (any type), null (if no data found for test) or string (if data type is log)
   */
  getData(context) {
    this.#refreshStorageType();

    let testId = null;
    if (typeof context === 'string') {
      testId = this.#tryToRetrieveTestId(context) || context;
    }

    if (!testId) {
      debug(`Cannot get test id from passed context:`, context);
      return null;
    }

    let testDataFromFile = [];
    let testDataFromGlobalVar = [];

    if (global?.testomatioDataStore) {
      testDataFromGlobalVar = this.#getDataFromGlobalVar(testId);
      // these frameworks use global variable storage
      // if (testDataFromGlobalVar && ['cucumber', 'codeceptjs'].includes(this.runningEnvironment)) {
      if (testDataFromGlobalVar) {
        // return as string if its log data
        if (this.dataType === 'log' && testDataFromGlobalVar.length) return testDataFromGlobalVar.join('\n');
        // return as array for other data types
        if (testDataFromGlobalVar.length) return testDataFromGlobalVar;
      }
      // don't return nothing if no data in global variable
    }

    /* condition is removed for mocha
    mocha has created a global storage, but just in some cases, generally it is not available
    */
    // if (this.isFileStorage || !testData) {
    //   testData = this.#getDataFromFile(testId);
    //   if (testData) return testData;
    // }

    testDataFromFile = this.#getDataFromFile(testId);

    if (testDataFromFile.length) {
      if (this.dataType === 'log') return testDataFromFile.join('\n');
      return testDataFromFile;
    }
    debug(`No "${this.dataType}" data for test id ${testId} in both file and global variable`);

    // in case no data found for test
    return null;
  }

  /**
   * This method is named as "try" because it does not guarantee that test id could be retrieved.
   * Context could be anything (test, suite, string, etc) which is used to define testId.
   * Or it could represent any other entity (which does not contain test id).
   * @param {*} context
   */
  #tryToRetrieveTestId(context) {
    if (!context) return null;
    this.#refreshStorageType();

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
  #refreshStorageType() {
    this.runningEnvironment = this.getRunningEnviroment();

    // some test frameworks do not persist global variables, thus file storage is used for them (by default)
    if (this.runningEnvironment === 'codeceptjs') this.isFileStorage = false;
    // playwrigth stores logs by itself; but file storage is used for other data types for playwright
    if (this.runningEnvironment === 'playwright' && this.dataType === 'log') this.isFileStorage = false;
  }

  /**
   * @param {*} testId
   * @returns aray of data (any type)
   */
  #getDataFromGlobalVar(testId) {
    try {
      if (global?.testomatioDataStore[this.dataType]) {
        const testData = global.testomatioDataStore[this.dataType][testId];
        if (testData) debug(`"${this.dataType}" data for test id ${testId}:`, testData.join(', '));
        return testData || [];
      }
      // debug(`No ${this.dataType} data for test id ${testId} in <global> storage`);
      return [];
    } catch (e) {
      // there could be no data, ignore
    }
  }

  /**
   *
   * @param {*} testId
   * @returns array of data (any type)
   */
  #getDataFromFile(testId) {
    try {
      const filepath = join(this.dataDirPath, `${this.dataType}_${testId}`);
      if (fs.existsSync(filepath)) {
        const testDataAsText = fs.readFileSync(filepath, 'utf-8');
        if (testDataAsText) debug(`"${this.dataType}" data for test id ${testId}:`, testDataAsText);
        const testDataArr = testDataAsText?.split(os.EOL) || [];
        return testDataArr;
      }
      // debug(`No ${this.dataType} data for test id ${testId} in <file> storage`);
      return [];
    } catch (e) {
      // there could be no data, ignore
    }
    return [];
  }

  /**
   * Puts data to global variable. Unlike the file storage, stores data in array (file storage just append as string).
   * @param {*} data
   * @param {*} testId
   */
  #putDataToGlobalVar(data, testId) {
    debug(`Saving data to global variable for test ${testId}:`, data);
    if (!global.testomatioDataStore) global.testomatioDataStore = {};
    if (!global.testomatioDataStore?.[this.dataType]) global.testomatioDataStore[this.dataType] = {};

    if (!global.testomatioDataStore?.[this.dataType][testId]) global.testomatioDataStore[this.dataType][testId] = [];
    global.testomatioDataStore[this.dataType][testId].push(data);
  }

  #putDataToFile(data, testId) {
    if (typeof data !== 'string') data = JSON.stringify(data);
    const filename = `${this.dataType}_${testId}`;
    const filepath = join(this.dataDirPath, filename);
    if (!fs.existsSync(this.dataDirPath)) fileSystem.createDir(this.dataDirPath);
    debug('Saving data to file for test', testId, 'to', filepath, ':\n', data, '\n');

    // append new line if file already exists (in this case its definitely includes some data)
    if (fs.existsSync(filepath)) {
      fs.appendFileSync(filepath, os.EOL + data, 'utf-8');
    } else {
      fs.writeFileSync(filepath, data, 'utf-8');
    }
  }
}

module.exports = DataStorage;

// TODO: consider using fs promises instead of writeSync/appendFileSync to
// prevent blocking and improve performance (probably queue usage will be required)

// TODO: rewrite client - everything regarding storing artifacts
// TODO: try to define adapter inside client
// TODO: ability to intercept multiple loggers (upd: no need)

/* does not work for Playwright
    try {
      const { test } = require('@playwright/test');
      test.beforeEach(async ({}, testInfo) => {
        global.testTitle = testInfo.title;
        global.testomatioRunningEnvironment = 'playwright';
      });
    } catch (e) {
      // ignore
    }
// Playwright storage works fine only when running tests from a single file;
// otherwise it is not possible to define test id/title, it is overwritten
 TODO: the only way implementation for Pw for now is to pass testInfo inside test
//  (and process this testInfo inside "put" function)
*/
