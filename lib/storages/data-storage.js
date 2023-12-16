const debug = require('debug')('@testomatio/reporter:storage');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { join } = require('path');
const { TESTOMAT_TMP_STORAGE_DIR } = require('../constants');
const { fileSystem, parseTest } = require('../utils/utils');

class DataStorage {
  /**
   * Creates data storage instance for specific data type.
   * Stores data to global variable or to file depending on what is applicable for current test runner
   * Recommend to use composition while using this class (instead of inheritance).
   * ! Also the class which will use data storage should be singleton (to avoid data loss).
   * @param {'log' | 'artifact'} dataType – storage type (like 'log', 'artifact'); could be any string, used only to define file path
   * @param {Object} options – adapter (e.g. codeceptjs adapter)
   */
  constructor(dataType, { isFileStorage }) {
    this.dataType = dataType || 'data';
    this.isFileStorage = isFileStorage ?? true;
    // if (this.adapter === 'playwright' && this.dataType === 'log') this.isFileStorage = false;

    this.dataDirPath = path.join(TESTOMAT_TMP_STORAGE_DIR, this.dataType);
  }

  #stringToFilename(str) {
    // TODO: use md5 hash later
    const validFilenameRegex = /[^a-zA-Z0-9_.-]/g;
    // replace all characters not in the regex above with underscore, then duplicate underscores removed
    return str.replace(validFilenameRegex, '_').replace(/_{2,}/g, '_').substring(0, 255); // max filename length
  }

  /**
   * Puts any data to storage (file or global variable).
   * If file: stores data as text, if global variable – stores as array of data.
   * @param {*} data anything you want to store (string, object, array, etc)
   * @param {*} context could be testId or any context (test name, suite name, including their IDs etc)
   * suite name + test name is used by default
   * @returns
   */
  putData(data, context = null) {
    fileSystem.createDir(this.dataDirPath);
    if (!context) {
      debug(`No test context provided for "${this.dataType}" data:`, data);
      return;
    }
    context = this.#stringToFilename(context);

    if (this.isFileStorage) {
      this.#putDataToFile(data, context);
    } else {
      this.#putDataToGlobalVar(data, context);
    }
  }

  /**
   * Returns data, stored for specific test/context (or data which was stored without test id specified).
   * This method will get data from global variable and/or from from file (previosly saved with put method).
   *
   * @param {*} context
   * @returns array of data (any type), null (if no data found for test) or string (if data type is log)
   */
  getData(context) {
    if (!context) {
      debug(`No context passed`, context);
      return null;
    }

    context = this.#stringToFilename(context);

    let testDataFromFile = [];
    let testDataFromGlobalVar = [];

    if (global?.testomatioDataStore) {
      testDataFromGlobalVar = this.#getDataFromGlobalVar(context);
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

    testDataFromFile = this.#getDataFromFile(context);

    if (testDataFromFile.length) {
      if (this.dataType === 'log') return testDataFromFile.join('\n');
      return testDataFromFile;
    }
    debug(`No "${this.dataType}" data for test id ${context} in both file and global variable`);

    // in case no data found for test
    return null;
  }

  /**
   * @param {*} context
   * @returns aray of data (any type)
   */
  #getDataFromGlobalVar(context) {
    try {
      if (global?.testomatioDataStore[this.dataType]) {
        const testData = global.testomatioDataStore[this.dataType][context];
        if (testData) debug(`"${this.dataType}" data for test id ${context}:`, testData.join(', '));
        return testData || [];
      }
      // debug(`No ${this.dataType} data for test context ${context} in <global> storage`);
      return [];
    } catch (e) {
      // there could be no data, ignore
    }
  }

  /**
   *
   * @param {*} context
   * @returns array of data (any type)
   */
  #getDataFromFile(context) {
    try {
      const filepath = join(this.dataDirPath, `${this.dataType}_${context}`);
      if (fs.existsSync(filepath)) {
        const testDataAsText = fs.readFileSync(filepath, 'utf-8');
        if (testDataAsText) debug(`"${this.dataType}" data for test id ${context}:`, testDataAsText);
        const testDataArr = testDataAsText?.split(os.EOL) || [];
        return testDataArr;
      }
      // debug(`No ${this.dataType} data for test ${context} in <file> storage`);
      return [];
    } catch (e) {
      // there could be no data, ignore
    }
    return [];
  }

  /**
   * Puts data to global variable. Unlike the file storage, stores data in array (file storage just append as string).
   * @param {*} data
   * @param {*} context
   */
  #putDataToGlobalVar(data, context) {
    debug('Saving data to global variable for ', context, ':', data);
    if (!global.testomatioDataStore) global.testomatioDataStore = {};
    if (!global.testomatioDataStore?.[this.dataType]) global.testomatioDataStore[this.dataType] = {};

    if (!global.testomatioDataStore?.[this.dataType][context]) global.testomatioDataStore[this.dataType][context] = [];
    global.testomatioDataStore[this.dataType][context].push(data);
  }

  #putDataToFile(data, context) {
    if (typeof data !== 'string') data = JSON.stringify(data);
    const filename = `${this.dataType}_${context}`;
    const filepath = join(this.dataDirPath, filename);
    if (!fs.existsSync(this.dataDirPath)) fileSystem.createDir(this.dataDirPath);
    debug('Saving data to file for', context, 'to', filepath, ':\n', data, '\n');

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
