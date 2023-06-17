const debug = require('debug')('@testomatio/reporter:logger');
const { DataStorage } = require('./dataStorage');
const { TESTOMAT_TMP_DIRS } = require('./constants');
const path = require('path');

const originalConsoleCopy = Object.assign({}, console);

// NOT IMPLEMENTED YET to intercept loggers like console.log
class Logger extends DataStorage {
  _dataDirPath = path.join(this._dataDirPath, TESTOMAT_TMP_DIRS.logs);
  _fileSuffix = 'log_';
  // used to output logs to console using the logger which user uses
  _originalUserLogger = originalConsoleCopy;
  // will be reassigned immediately when added
  _loggerToIntercept = console;
  _logs = [];
  _logMethods = ['assert', 'debug', 'error', 'info', 'log', 'trace', 'warn'];

  constructor(params = {}) {
    super(params);

    if (params?.logger) this._loggerToIntercept = params.logger;
    if (this._isFileStorage) {
      this._createDir(this._dataDirPath);
    }

    this.interceptLogger(this._loggerToIntercept);

    // singleton
    if (!Logger.instance) {
      Logger.instance = this;
    }
    return Logger.instance;
  }

  // TODO: try to use method generator *

  assert(...args) {
    this.put(...args);
    debug(...args);
    this._originalUserLogger.log(`Assertion result: `, ...args);
  }

  debug(...args) {
    this.put(...args);
    this._originalUserLogger.debug(...args);
  }

  error(...args) {
    this.put(...args);
    this._originalUserLogger.error(...args);
  }

  info(...args) {
    this.put(...args);
    this._originalUserLogger.info(...args);
  }

  log(...args) {
    this.put(...args);
    this._originalUserLogger.log(...args);
  }

  trace(...args) {
    this.put(...args);
    this._originalUserLogger.trace(...args);
  }
  
  warn(...args) {
    this.put(...args);
    this._originalUserLogger.warn(...args);
  }

  /**
   * Intercepts user logger (console by default)
   * @param {*} userLogger 
   */
  interceptLogger(userLogger) {
    // save original user logger to use it for logging
    this._originalUserLogger = Object.assign({}, userLogger);
    this._loggerToIntercept = userLogger;

    // override user logger (any, e.g. console) methods to intercept log messages
    for (const method of this._logMethods) {
      if (!this._loggerToIntercept[method]) continue;

      this._loggerToIntercept[method] = (...args) => {
        this._logs.push({ level: method, message: args.join('\n') });
        try {
          // log message, this is what user expects
          this._loggerToIntercept[method](...args);
          // method could be unexisting, ignore error
        } catch (e) {}
      };
    }
  }

  // TODO: implement
  // getLogs() {
  //   return this.logs;
  // }

  // TODO: implement
  // clearLogs() {
  //   this.logs = [];
  // }
}

Logger.instance = null;

module.exports.Logger = Logger;
module.exports = new Logger();

// TODO: consider using fs promises instead of writeSync/appendFileSync to prevent blocking and improve performance
