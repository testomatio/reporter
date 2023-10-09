const DataStorage = require('./data-storage');

class KeyValueStorage {
  constructor() {
    this.dataStorage = new DataStorage('keyvalue');

    // singleton
    if (!KeyValueStorage.instance) {
      KeyValueStorage.instance = this;
    }
  }

  get() {
    this.dataStorage.getData();
  }

  // override current test file
  /**
   * 
   * @param {*} data should be an object
   * @param {*} context 
   */
  set(data, context = null) {
    this.dataStorage.putData(data, context);
  }

}

KeyValueStorage.instance = null;

module.exports = new KeyValueStorage();
