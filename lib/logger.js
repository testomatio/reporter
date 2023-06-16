const debug = require('debug')('@testomatio/reporter:logger');
const { DataStorage } = require('./dataStorage');
const { TESTOMAT_TMP_DIRS } = require('./constants');
const path = require('path');

// NOT IMPLEMENTED YET to intercept loggers like console.log
class Logger extends DataStorage {
  dataDirPath = path.join(this.dataDirPath, TESTOMAT_TMP_DIRS.logs);
  fileSuffix = 'log_';

  constructor(params = {}) {
    super(params);

    if (this.isFileStorage) {
      this._createDir(this.dataDirPath);
    }

    if (!Logger.instance) {
      Logger.instance = this;
    }
    return Logger.instance;
  }

  /**
   *
   * @param {*} content
   * @param {*} context testID or context
   * @returns
   */
  log(content, context) {
    // TODO: consider not using context
    // TODO: align with put method - use args
    return this.put(content, context);
  }
}

Logger.instance = null;

module.exports = new Logger();
module.exports.Logger = Logger;

// TODO: consider using fs promises instead of writeSync/appendFileSync to prevent blocking and improve performance
