const debug = require('debug')('@testomatio/reporter:logger');
const { DataStorage } = require('./dataStorage');

const LOG_METHODS = ['assert', 'debug', 'error', 'info', 'log', 'trace', 'warn'];

class Logger {
  // used to output logs to console by the user logger
  _originalUserLogger;
  // is intercepted and reassigned immediately when added
  _loggerToIntercept;

  constructor(params = {}) {
    this.dataStorage = new DataStorage('logger', params);

    // commented because prefer to use "intercept" method
    // if (params?.logger) this._loggerToIntercept = params.logger;

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
   * 2. Standard: $(`text ${someVar}`)
   * 3. Standard with multiple arguments: $('text', someVar)
   */
  $(strings, ...args) {
    let logs;
    // this block means tagged template is used (syntax like $`text ${someVar}`)
    if (Array.isArray(strings) && strings.length === args.length + 1) {
      logs = strings.reduce((result, current, index) => {
        return (
          result +
          current +
          // strings are splitted by args when use tagged template, thus we add arg after each string
          (args[index] !== undefined
            ? typeof args[index] === 'string'
              ? // add arg as it is
                args[index]
              : // stringify arg
                this._strinfifyLogs(args[index])
            : ' ')
        );
      }, '');
    } else {
      // this block means arguments syntax is used (syntax like $('text', someVar))
      logs = this._strinfifyLogs(strings, ...args);
    }
    this.dataStorage.putData(logs);
  }

  getLogs(context) {
    return this.dataStorage.getData(context);
  }

  _strinfifyLogs(...args) {
    let logs = [];
    // stringify everything except strings
    for (const arg of args) {
      if (typeof arg === 'string') {
        logs.push(arg);
      } else {
        logs.push(JSON.stringify(arg));
      }
    }
    return logs.join(' ');
  }

  assert(...args) {
    const logs = this._strinfifyLogs(...args);
    this.dataStorage.putData(logs);
    try {
      this._originalUserLogger.log(`Assertion result: `, ...args);
      // method could be unexisting, ignore error
    } catch (e) {}
  }

  debug(...args) {
    const logs = this._strinfifyLogs(...args);
    this.dataStorage.putData(logs);
    try {
      this._originalUserLogger.debug(...args);
    } catch (e) {}
  }

  error(...args) {
    const logs = this._strinfifyLogs(...args);
    this.dataStorage.putData(logs);
    try {
      this._originalUserLogger.error(...args);
    } catch (e) {}
  }

  info(...args) {
    const logs = this._strinfifyLogs(...args);
    this.dataStorage.putData(logs);
    try {
      this._originalUserLogger.info(...args);
    } catch (e) {}
  }

  log(...args) {
    const logs = this._strinfifyLogs(...args);
    this.dataStorage.putData(logs);
    try {
      this._originalUserLogger.log(...args);
    } catch (e) {}
  }

  trace(...args) {
    const logs = this._strinfifyLogs(...args);
    this.dataStorage.putData(logs);
    try {
      this._originalUserLogger.trace(...args);
    } catch (e) {}
  }

  warn(...args) {
    const logs = this._strinfifyLogs(...args);
    this.dataStorage.putData(logs);
    try {
      this._originalUserLogger.warn(...args);
    } catch (e) {}
  }

  /**
   * Intercepts user logger
   * @param {*} userLogger
   */
  intercept(userLogger) {
    if (!userLogger) return;
    debug(`Intercepting user logger ${userLogger.toString ? userLogger.toString() : ''}`);

    // save original user logger to use it for logging
    this._originalUserLogger = Object.assign({}, userLogger);
    this._loggerToIntercept = userLogger;

    /* 
    override user logger (any, e.g. console) methods to intercept log messages
    this._loggerToIntercept = this; could be used, but decided to override only output methods
    */
    for (const method of LOG_METHODS) {
      /*
      decided to comment next code line because its better to create method even if it does not exist in user logger;
      on method invocation, we will store the data anyway and catch block will prevent potential errors
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

// module.exports.Logger = Logger;
module.exports = new Logger();

// TODO: consider using fs promises instead of writeSync/appendFileSync to prevent blocking and improve performance
// TODO: try to use method generator *
// TODO: understand captureStackTrace in output (check on .error) (NOT SUCH IMPORTANT)
// TODO: make logger not extend Data storage  but create instance of it (REQUIRES DISCUSSION)
