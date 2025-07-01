const debug = require('debug')('@testomatio/reporter:services-key-value');
const { dataStorage } = require('../data-storage');

class KeyValueStorage {
  static #instance;

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
   * Stores key-value pair and passes it to reporter
   * @param {{key: string}} keyValue - key-value pair(s) as object
   * @param {*} context - full test title
   */
  put(keyValue, context = null) {
    if (!keyValue) return;
    dataStorage.putData('keyvalue', keyValue, context);
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
    const keyValuesList = dataStorage.getData('keyvalue', context);
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
