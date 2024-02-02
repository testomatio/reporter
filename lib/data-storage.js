const debug = require('debug')('@testomatio/reporter:storage');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { join } = require('path');
const { TESTOMAT_TMP_STORAGE_DIR } = require('./constants');
const { fileSystem, testRunnerHelper } = require('./utils/utils');
const crypto = require('crypto');

class DataStorage {
  static #instance;

  context;

  /**
   *
   * @returns {DataStorage}
   */
  static getInstance() {
    if (!this.#instance) {
      this.#instance = new DataStorage();
    }
    return this.#instance;
  }

  setContext(context) {
    this.context = context;
  }

  /**
   * Creates data storage instance as singleton
   * Stores data to global variable or to file depending on what is applicable for current test runner (adapter)
   * Recommend to use composition while using this class (instead of inheritance).
   * ! Also the class which will use data storage should be singleton (to avoid data loss).
   */
  constructor() {
    // some frameworks use global variable to store data, some use file storage
    this.isFileStorage = true;
  }

  /**
   * Puts any data to storage (file or global variable).
   * If file: stores data as text, if global variable – stores as array of data.
   * @param {'log' | 'artifact' | 'keyvalue'} dataType
   * @param {*} data anything you want to store (string, object, array, etc)
   * @param {*} context could be testId or any context (test name, suite name, including their IDs etc)
   * suite name + test name is used by default
   * @returns
   */
  putData(dataType, data, context = null) {
    if (!dataType || !data) return;

    context = context || this.context || testRunnerHelper.getNameOfCurrentlyRunningTest();
    if (!context) {
      debug(`No context provided for "${dataType}" data:`, data);
      return;
    }
    const contextHash = stringToMD5Hash(context);

    if (this.isFileStorage) {
      const dataDirPath = path.join(TESTOMAT_TMP_STORAGE_DIR, dataType);
      fileSystem.createDir(dataDirPath);
      this.#putDataToFile(dataType, data, contextHash);
    } else {
      this.#putDataToGlobalVar(dataType, data, contextHash);
    }
  }

  /**
   * Returns data, stored for specific test/context (or data which was stored without test id specified).
   * This method will get data from global variable and/or from from file (previosly saved with put method).
   *
   * @param {'log' | 'artifact' | 'keyvalue'} dataType
   * @param {string} context
   * @returns {any []} array of data (any type), null (if no data found for context) or string (if data type is log)
   */
  getData(dataType, context) {
    // TODO: think if it could be useful
    // context = context || this.context || testRunnerHelper.getNameOfCurrentlyRunningTest();

    if (!context) {
      debug(`Trying to get "${dataType}" data without context`);
      return null;
    }

    const contextHash = stringToMD5Hash(context);

    let testDataFromFile = [];
    let testDataFromGlobalVar = [];

    if (global?.testomatioDataStore) {
      testDataFromGlobalVar = this.#getDataFromGlobalVar(dataType, contextHash);
      if (testDataFromGlobalVar) {
        if (testDataFromGlobalVar.length) return testDataFromGlobalVar;
      }
      // don't return nothing if no data in global variable
    }

    testDataFromFile = this.#getDataFromFile(dataType, contextHash);

    if (testDataFromFile.length) {
      return testDataFromFile;
    }
    debug(`No "${dataType}" data for context "${contextHash}" in both file and global variable`);

    // in case no data found for context
    return null;
  }

  /**
   * @param {'log' | 'artifact' | 'keyvalue'} dataType
   * @param {string} context
   * @returns aray of data (any type)
   */
  #getDataFromGlobalVar(dataType, context) {
    try {
      if (global?.testomatioDataStore[dataType]) {
        const testData = global.testomatioDataStore[dataType][context];
        if (testData) debug(`"${dataType}" data for constext "${context}":`, testData.join(', '));
        return testData || [];
      }
      // debug(`No ${this.dataType} data for context ${context} in <global> storage`);
      return [];
    } catch (e) {
      // there could be no data, ignore
    }
  }

  /**
   * @param {'log' | 'artifact' | 'keyvalue'} dataType
   * @param {*} context
   * @returns array of data (any type)
   */
  #getDataFromFile(dataType, context) {
    const dataDirPath = path.join(TESTOMAT_TMP_STORAGE_DIR, dataType);
    try {
      const filepath = join(dataDirPath, `${dataType}_${context}`);
      if (fs.existsSync(filepath)) {
        const testDataAsText = fs.readFileSync(filepath, 'utf-8');
        if (testDataAsText) debug(`"${dataType}" data for context "${context}":`, testDataAsText);
        const testDataArr = testDataAsText?.split(os.EOL) || [];
        return testDataArr;
      }
      // debug(`No ${this.dataType} data for ${context} in <file> storage`);
      return [];
    } catch (e) {
      // there could be no data, ignore
    }
    return [];
  }

  /**
   * Puts data to global variable. Unlike the file storage, stores data in array (file storage just append as string).
   * @param {'log' | 'artifact' | 'keyvalue'} dataType
   * @param {*} data
   * @param {*} context
   */
  #putDataToGlobalVar(dataType, data, context) {
    debug('Saving data to global variable for ', context, ':', data);
    if (!global.testomatioDataStore) global.testomatioDataStore = {};
    if (!global.testomatioDataStore?.[dataType]) global.testomatioDataStore[dataType] = {};

    if (!global.testomatioDataStore?.[dataType][context]) global.testomatioDataStore[dataType][context] = [];
    global.testomatioDataStore[dataType][context].push(data);
  }

  /**
   * Puts data to file. Unlike the global variable storage, stores data as string
   * @param {'log' | 'artifact' | 'keyvalue'} dataType
   * @param {*} data
   * @param {string} context
   * @returns
   */
  #putDataToFile(dataType, data, context) {
    const dataDirPath = path.join(TESTOMAT_TMP_STORAGE_DIR, dataType);
    if (typeof data !== 'string') data = JSON.stringify(data);
    const filename = `${dataType}_${context}`;
    const filepath = join(dataDirPath, filename);
    if (!fs.existsSync(dataDirPath)) fileSystem.createDir(dataDirPath);
    debug(`Saving data to file for context "${context}" to ${filepath}. Data: ${JSON.stringify(data)}`);

    // append new line if file already exists (in this case its definitely includes some data)
    if (fs.existsSync(filepath)) {
      fs.appendFileSync(filepath, os.EOL + data, 'utf-8');
    } else {
      fs.writeFileSync(filepath, data, 'utf-8');
    }
  }
}

function stringToMD5Hash(str) {
  const md5 = crypto.createHash('md5');
  md5.update(str);
  const hash = md5.digest('hex');

  return hash;
}

module.exports.dataStorage = DataStorage.getInstance();
module.exports.stringToMD5Hash = stringToMD5Hash;

// TODO: consider using fs promises instead of writeSync/appendFileSync to
// prevent blocking and improve performance (probably queue usage will be required)
