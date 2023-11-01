const debug = require('debug')('@testomatio/reporter:key-value-storage');
const DataStorage = require('./data-storage');

class KeyValueStorage {
  constructor() {
    this.dataStorage = new DataStorage('keyvalue');

    // singleton
    if (!KeyValueStorage.instance) {
      KeyValueStorage.instance = this;
    }
  }

  /**
   * Stores key-value pair and passes it to reporter
   * @param {{key: string}} keyValue - key-value pair(s) as object
   * @param {*} context testId or test title
   */
  put(keyValue, context = null) {
    if (!keyValue) return;
    this.dataStorage.putData(keyValue, context);
  }

  #isKeyValueObject(smth) {
    return smth && typeof smth === 'object' && !Array.isArray(smth) && smth !== null;
  }

  /**
   * Returns key-values pairs for the test as object
   * @param {*} context testId or test context from test runner
   * @returns {Object} key-values pairs as object
   */
  get(context) {
    if (!context) return null;

    const keyValuesList = this.dataStorage.getData(context);
    if (!keyValuesList || !keyValuesList?.length) return null;

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

    return Object.keys(keyValues).length ? keyValues : null;
  }
}

KeyValueStorage.instance = null;

module.exports = new KeyValueStorage();
