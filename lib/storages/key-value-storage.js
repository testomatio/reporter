const debug = require('debug')('@testomatio/reporter:key-value-storage');
const DataStorage = require('./data-storage');

class KeyValueStorage {
  static #instance;

  #context;

  constructor() {
    this.dataStorage = new DataStorage('keyvalue');
  }

  /**
   *
   * @returns {KeyValueStorage}
   */
  static getInstance() {
    if (!this.#instance) {
      this.#instance = new KeyValueStorage();
    }
    return this.#instance;
  }

  /**
   * @param {string} context - suite title + test title
   */
  setContext(context) {
    this.#context = context;
  }

  /**
   * Stores key-value pair and passes it to reporter
   * @param {{key: string}} keyValue - key-value pair(s) as object
   */
  put(keyValue) {
    if (!keyValue) return;
    this.dataStorage.putData(keyValue, this.#context);
  }

  #isKeyValueObject(smth) {
    return smth && typeof smth === 'object' && !Array.isArray(smth) && smth !== null;
  }

  /**
   * Returns key-values pairs for the test as object
   * @param {*} context testId or test context from test runner
   * @returns {{[key: string]: string} | {}} key-values pairs as object, e.g. {priority: 'high', browser: 'chrome'}
   */
  get(context = null) {
    context = context || this.#context;
    if (!context) return {};

    const keyValuesList = this.dataStorage.getData(context);
    if (!keyValuesList || !keyValuesList?.length) return {};

    const keyValues = {};
    for (const keyValue of keyValuesList) {
      if (this.#isKeyValueObject(keyValue)) {
        Object.assign(keyValues, keyValue);
      } else if (typeof keyValue === 'string') {
        try {
          Object.assign(keyValues, JSON.parse(keyValue));
        } catch (e) {
          debug(`Error parsing key-values for test ${context}`, keyValue);
        }
      }
    }

    return keyValues;
  }
}

module.exports.keyValueStorage = KeyValueStorage.getInstance();
