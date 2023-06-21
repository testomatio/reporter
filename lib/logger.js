const chalk = require('chalk');
const debug = require('debug')('@testomatio/reporter:logger');
const { DataStorage } = require('./dataStorage');

const LOG_METHODS = ['assert', 'debug', 'error', 'info', 'log', 'trace', 'warn'];
const LEVELS = {
  ALL: { severity: 1, color: '' },
  VERBOSE: { severity: 3, color: 'grey' },
  TRACE: { severity: 5, color: 'grey' },
  DEBUG: { severity: 7, color: 'cyan' },
  INFO: { severity: 9, color: 'black' },
  LOG: { severity: 11, color: 'black' },
  WARN: { severity: 13, color: 'yellow' },
  ERROR: { severity: 15, color: 'red' },
};

/**
 * Logger allows to:
 * 1. Intercept logs from user logger (console.log, etc) and store them.
 * 2. Output logs to console (actually, logger functionality).
 * 3. Varied syntax.
 */
class Logger {
  // _originalUserLogger used to output logs to console by the user logger
  // _loggerToIntercept intercepted and reassigned immediately when added

  constructor(params = {}) {
    // set default logger to be used in log, warn, error, etc methods
    this._originalUserLogger = { ...console };

    this.dataStorage = new DataStorage('log', params);
    this.logLevel = process?.env?.LOG_LEVEL?.toUpperCase() || 'ALL';

    // commented because prefer to use "intercept" method
    // if (params?.logger) this._loggerToIntercept = params.logger;

    this.intercept(this._loggerToIntercept);

    // singleton
    if (!Logger.instance) {
      Logger.instance = this;
    }
  }

  /**
   * Returns the string (logs) and the context
   * This is required because loggers take multiple arguments
   * @param  {...any} args
   */
  /*
    TODO: its difficult to distinguish context from log artument if its not a string,
    e.g. user can use something like console.log('some log', { key: 'value' });
    consider not to use this method at all and don't expect context from user inside default log methods;
    instead, use custom method like $`some log` and parse it
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
   * Tagget template literal. Allows to use different syntaxes:
   * 1. Tagget template: $`text ${someVar}`
   * 2. Standard: $(`text ${someVar}`)
   * 3. Standard with multiple arguments: $('text', someVar)
   */
  _log(strings, ...args) {
    let logs;
    // this block means tagged template is used (syntax like $`text ${someVar}`)
    if (Array.isArray(strings) && strings.length === args.length + 1) {
      logs = strings.reduce(
        (result, current, index) =>
          result +
          current +
          // strings are splitted by args when use tagged template, thus we add arg after each string
          // it looks like: `string1 arg1 string2 arg2 string3`
          (args[index] !== undefined // eslint-disable-line no-nested-ternary
            ? typeof args[index] === 'string'
              ? args[index] // add arg as it is
              : this._strinfifyLogs(args[index]) // stringify arg
            : ' '), // add space if no arg after string
        // initial accumulator value
        '',
      );
    } else {
      // this block means arguments syntax is used (syntax like $('text', someVar))
      // in this case strings represents just a first argument
      logs = this._strinfifyLogs(strings, ...args);
    }
    this.dataStorage.putData(logs);
  }

  /**
   * Allows you to define a step inside a test. Step name is attached to the report and
   * helps to understand the test flow.
   * @param {*} strings 
   * @param  {...any} values 
   */
  step(strings, ...values) {
    let logs = '';
    for (let i = 0; i < strings.length; i++) {
      logs += strings[i];
      if (i < values.length) {
        logs += values[i];
      }
    }
    logs = chalk.blue(`> ${logs}`);
    this.dataStorage.putData(logs);
  }

  /**
   *
   * @param {*} context testId or test context from test runner
   * @returns
   */
  getLogs(context) {
    return this.dataStorage.getData(context);
  }

  _strinfifyLogs(...args) {
    const logs = [];
    // stringify everything except strings
    for (const arg of args) {
      if (typeof arg === 'string') {
        logs.push(arg);
      } else {
        try {
          // eslint-disable-next-line no-unused-expressions
          this.prettyObjects ? logs.push(JSON.stringify(arg, null, 2)) : logs.push(JSON.stringify(arg));
        } catch (e) {
          debug('Error while stringify object', e);
          logs.push(arg);
        }
      }
    }
    return logs.join(' ');
  }

  assert(...args) {
    const level = 'ERROR';
    const severity = LEVELS[level].severity;
    if (severity < LEVELS[this.logLevel]?.severity) return;

    const logs = this._strinfifyLogs(...args);
    this.dataStorage.putData(logs);
    try {
      this._originalUserLogger.log(`Assertion result: `, ...args);
    } catch (e) {
      // method could be unexisting, ignore error
    }
  }

  debug(...args) {
    const level = 'DEBUG';
    const severity = LEVELS[level].severity;
    if (severity < LEVELS[this.logLevel]?.severity) return;

    if (this.logLevel === 'error' || this.logLevel === 'warn') return;
    const logs = this._strinfifyLogs(...args);
    const colorizedLogs = chalk[LEVELS[level].color](logs);
    this.dataStorage.putData(colorizedLogs);
    try {
      this._originalUserLogger.debug(...args);
    } catch (e) {
      // method could be unexisting, ignore error
    }
  }

  error(...args) {
    const level = 'ERROR';
    const severity = LEVELS[level].severity;
    if (severity < LEVELS[this.logLevel]?.severity) return;

    const logs = this._strinfifyLogs(...args);
    const colorizedLogs = chalk[LEVELS[level].color](logs);
    this.dataStorage.putData(colorizedLogs);
    try {
      this._originalUserLogger.error(...args);
    } catch (e) {
      // method could be unexisting, ignore error
    }
  }

  info(...args) {
    const level = 'INFO';
    const severity = LEVELS[level].severity;
    if (severity < LEVELS[this.logLevel]?.severity) return;

    const logs = this._strinfifyLogs(...args);
    this.dataStorage.putData(logs);
    try {
      this._originalUserLogger.info(...args);
    } catch (e) {
      // method could be unexisting, ignore error
    }
  }

  log(...args) {
    const level = 'INFO';
    const severity = LEVELS[level].severity;
    if (severity < LEVELS[this.logLevel]?.severity) return;

    const logs = this._strinfifyLogs(...args);
    this.dataStorage.putData(logs);
    try {
      this._originalUserLogger.log(...args);
    } catch (e) {
      // method could be unexisting, ignore error
    }
  }

  trace(...args) {
    const level = 'TRACE';
    const severity = LEVELS[level].severity;
    if (severity < LEVELS[this.logLevel]?.severity) return;

    const logs = this._strinfifyLogs(...args);
    const colorizedLogs = chalk[LEVELS[level].color](logs);
    this.dataStorage.putData(colorizedLogs);
    try {
      this._originalUserLogger.trace(...args);
    } catch (e) {
      // method could be unexisting, ignore error
    }
  }

  warn(...args) {
    const level = 'WARN';
    const severity = LEVELS[level].severity;
    if (severity < LEVELS[this.logLevel]?.severity) return;

    const logs = this._strinfifyLogs(...args);
    const colorizedLogs = chalk[LEVELS[level].color](logs);
    this.dataStorage.putData(colorizedLogs);
    try {
      this._originalUserLogger.warn(...args);
    } catch (e) {
      // method could be unexisting, ignore error
    }
  }

  /**
   * Intercepts user logger messages.
   * When call this method, Logger start to control the user logger,
   * but almost nothing is changed for user ragarding the console output (like log level set by user)
   * (until multiple loggers are intercepted,
   * in this case only the last intercepted logger will be used as user console output).
   * @param {*} userLogger
   */
  intercept(userLogger) {
    if (!userLogger) return;
    debug(`Intercepting user logger`);

    // save original user logger to use it for logging (last intercepted will be used for console output)
    this._originalUserLogger = { ...userLogger };
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

  /**
   * Allows to configure logger. Make sure you do it before the logger usage in your code.
   *
   * @param {Object} [config={}] - The configuration object.
   * @param {string} [config.logLevel] - The desired log level. Valid values are 'DEBUG', 'INFO', 'WARN', and 'ERROR'.
   * @param {boolean} [config.prettyObjects] - Specifies whether to enable pretty printing of objects.
   * @returns {void}
   */
  configure(config = {}) {
    if (!config) return;
    if (config.prettyObjects) this.prettyObjects = config.prettyObjects;
    if (config.logLevel) this.logLevel = config.logLevel.toUpperCase();
  }
}

Logger.instance = null;

// module.exports.Logger = Logger;
module.exports = new Logger();

// TODO: consider using fs promises instead of writeSync/appendFileSync to prevent blocking and improve performance
// TODO: parse passed arguments as {level: 'str', message: 'str'} because some loggers use such syntax;
// upd: did not face such loggers, but still could be useful

// TODO: in case of unset _originalUserLogger, logger.{method} will not provide console output,
// need to add some logger by default
