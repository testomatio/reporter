const debug = require('debug')('@testomatio/reporter:logger');
const { DataStorage } = require('./dataStorage');
const { TESTOMAT_TMP_STORAGE } = require('./constants');
const path = require('path');

const dataDirPath = path.join(TESTOMAT_TMP_STORAGE.mainDir, TESTOMAT_TMP_STORAGE.dirs.logs);
const LOG_METHODS = ['assert', 'debug', 'error', 'info', 'log', 'trace', 'warn'];

class Logger extends DataStorage {
  _fileSuffix = TESTOMAT_TMP_STORAGE.fileSuffixes.logs;
  // used to output logs to console using the logger which user uses
  _originalUserLogger;
  // will be reassigned immediately when added
  _loggerToIntercept;

  constructor(params = {}) {
    super(params);

    // commented because prefer to use "intercept" method
    // if (params?.logger) this._loggerToIntercept = params.logger;

    if (this._isFileStorage) {
      this._createDir(dataDirPath);
    }

    this.intercept(this._loggerToIntercept);

    // singleton
    if (!Logger.instance) {
      Logger.instance = this;
    }
    return Logger.instance;
  }

  /**
   * Returns the string (logs) and the context
   * This is required because loggers take multiple arguments
   * @param  {...any} args
   */
  /*
    TODO: its difficult to distinguish context from log artument if its not a string, e.g. user can use something like console.log('some log', { key: 'value' });
    consider not to use this method at all and don't expect context from user inside default log methods; instead, use custom method like $`some log` and parse it
  */
  // _getLogStringAndContextFromArgs(...args) {
  //   let context = '';
  //   if (args.length > 1 && typeof args[args.length - 1] !== 'string') {
  //     context = args.pop();
  //   }
  //   const logs = args.join(' ');
  //   return { logs, context };
  // }

  /**
   * Allows to use different syntaxes:
   * 1. Tagget template: $`text ${someVar}`
   * 2. Common: $(`text ${someVar}`)
   * 3. With multiple arguments: $('text', someVar)
   */
  $(strings, ...args) {
    let logs;
    // this block means tagged template is used (syntax like $`text ${someVar}`)
    if (Array.isArray(strings) && strings.length === args.length + 1) {
      logs = strings.reduce((result, current, index) => {
        return (
          result +
          '' +
          current +
          (args[index] !== undefined
            ? typeof args[index] === 'string'
              ? args[index]
              : this._strinfifyLogs(args[index])
            : ' ')
        );
      }, '');
    } else {
      // this block meand arguments syntax is used (syntax like $('text', someVar))
      const stringifiedArgs = [];
      for (const arg of [strings, ...args]) {
        stringifiedArgs.push(this._strinfifyLogs(arg));
      }
      logs = stringifiedArgs.join(' ');
    }
    this.putData(logs);
  }

  _strinfifyLogs(...args) {
    let logs = [];
    // stringify everything except strings
    for (const arg of args) {
      if (typeof arg === 'string') {
        logs.push(arg);
      } else {
        logs.push(JSON.stringify(arg, null, 2));
      }
    }
    return logs.join(' ');
  }

  assert(...args) {
    const logs = this._strinfifyLogs(...args);
    this.putData(logs);
    try {
      this._originalUserLogger.log(`Assertion result: `, ...args);
      // method could be unexisting, ignore error
    } catch (e) {}
  }

  debug(...args) {
    const logs = this._strinfifyLogs(...args);
    this.putData(logs);
    try {
      this._originalUserLogger.debug(...args);
    } catch (e) {}
  }

  error(...args) {
    const logs = this._strinfifyLogs(...args);
    this.putData(logs);
    try {
      this._originalUserLogger.error(...args);
    } catch (e) {}
  }

  info(...args) {
    const logs = this._strinfifyLogs(...args);
    this.putData(logs);
    try {
      this._originalUserLogger.info(...args);
    } catch (e) {}
  }

  log(...args) {
    const logs = this._strinfifyLogs(...args);
    this.putData(logs);
    try {
      this._originalUserLogger.log(...args);
    } catch (e) {}
  }

  trace(...args) {
    const logs = this._strinfifyLogs(...args);
    this.putData(logs);
    try {
      this._originalUserLogger.trace(...args);
    } catch (e) {}
  }

  warn(...args) {
    const logs = this._strinfifyLogs(...args);
    this.putData(logs);
    try {
      this._originalUserLogger.warn(...args);
    } catch (e) {}
  }

  /**
   * Intercepts user logger (console by default)
   * @param {*} userLogger
   */
  intercept(userLogger) {
    if (!userLogger) return;

    // save original user logger to use it for logging
    this._originalUserLogger = Object.assign({}, userLogger);
    this._loggerToIntercept = userLogger;

    /* 
    override user logger (any, e.g. console) methods to intercept log messages
    this._loggerToIntercept = this; could be used, but decided to override only output methods
    */
    for (const method of LOG_METHODS) {
      /*
      decided to comment because its better to create method even if it does not exist in user logger;
      on method invocation, we will store the data anyway and catch block will prevent errors
      */
      // if (!this._loggerToIntercept[method]) continue;
      this._loggerToIntercept[method] = (...args) => this[method](...args);
    }
  }

  // TODO: implement
  // TODO: will be callen inside adapters
  clearLogs() {
    this.logs = [];
  }
}

Logger.instance = null;

module.exports.Logger = Logger;
module.exports = new Logger();

// TODO: consider using fs promises instead of writeSync/appendFileSync to prevent blocking and improve performance
// TODO: try to use method generator *
// TODO: understand captureStackTrace in output (check on .error) (NOT SUCH IMPORTANT)
// TODO: make logger not extend Data storage  but create instance of it (REQUIRES DISCUSSION)
