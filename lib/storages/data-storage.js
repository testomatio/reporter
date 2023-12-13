const debug = require('debug')('@testomatio/reporter:storage');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { join } = require('path');
const { TESTOMAT_TMP_STORAGE_DIR } = require('../constants');
const { fileSystem, parseTest } = require('../utils/utils');

// const getTestIdFromTestTitle = parseTest;

class DataStorage {
  /**
   * Creates data storage instance for specific data type.
   * Stores data to global variable or to file depending on what is applicable for current test runner
   * Recommend to use composition while using this class (instead of inheritance).
   * ! Also the class which will use data storage should be singleton (to avoid data loss).
   * @param {'log' | 'artifact'} dataType – storage type (like 'log', 'artifact'); could be any string, used only to define file path
   * @param {Object} options – adapter (e.g. codeceptjs adapter), testId
   */
  constructor(dataType, { isFileStorage, testId }) {
    this.testId = testId;
    this.dataType = dataType || 'data';
    this.isFileStorage = isFileStorage ?? true;
    // if (this.adapter === 'playwright' && this.dataType === 'log') this.isFileStorage = false;

    this.dataDirPath = path.join(TESTOMAT_TMP_STORAGE_DIR, this.dataType);
  }

  /**
   * Puts any data to storage (file or global variable).
   * If file: stores data as text, if global variable – stores as array of data.
   * @param {*} data anything you want to store (string, object, array, etc)
   * @param {*} testId could be testId or any context (test, suite, etc) which is used to define testId
   * @returns
   */
  putData(data, testId = null) {
    fileSystem.createDir(this.dataDirPath);
    testId = testId || this.testId;

    // if (this.adapter === 'codeceptjs') {
    //   this.isFileStorage = false;
    // }

    // // logs in playwright are gathered by pw framework itself
    // if (this.adapter === 'playwright' && this.dataType === 'log') return;

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
   * @param {*} testId
   * @returns array of data (any type), null (if no data found for test) or string (if data type is log)
   */
  getData(testId) {
    if (!testId) {
      debug(`No test id passed`, testId);
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
    debug('Saving data to global variable for test', testId, ':', data);
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
