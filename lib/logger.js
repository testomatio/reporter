const chalk = require('chalk');
const debug = require('debug')('@testomatio/reporter:logger');
const _ = require('lodash');
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

  constructor() {
    // set default logger to be used in log, warn, error, etc methods
    this._originalUserLogger = { ...console };

    this.dataStorage = new DataStorage('log');
    this.logLevel = process?.env?.LOG_LEVEL?.toUpperCase() || 'ALL';

    // commented because prefer to use "intercept" method
    // if (params?.logger) this._loggerToIntercept = params.logger;

    // intercept console by default
    this.intercept(console);

    // singleton
    if (!Logger.instance) {
      Logger.instance = this;
    }

    this._helpers = {
      parseLastArgToGetTestId: (...args) => {
        try {
          return this.dataStorage._tryToRetrieveTestId(args.at(-1));
        } catch (e) {
          // node 14 support
          return this.dataStorage._tryToRetrieveTestId(args[args.length - 1]);
        }
      },
    };
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
    const logs = this.dataStorage.getData(context);
    return logs || '';
  }

  _stringifyLogs(...args) {
    const logs = [];
    // stringify everything except strings
    for (const arg of args) {
      // ignore empty strings
      if (arg === '') continue;
      if (typeof arg === 'string') {
        logs.push(arg);
      } else if (Array.isArray(arg)) {
        logs.push(arg.join(' '));
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

  /**
   * Tagget template literal. Allows to use different syntaxes:
   * 1. Tagget template: $`text ${someVar}`
   * 2. Standard: $(`text ${someVar}`)
   * 3. Standard with multiple arguments: $('text', someVar)
   */
  _log(strings, ...args) {
    // entity which is used to define testId
    let context = null;
    // last argument could contain testId
    const testId = this._helpers.parseLastArgToGetTestId(...args);
    if (testId) {
      // last arg is test id, do not log it
      context = args.pop();
    }

    // filter empty strings
    strings = strings.filter(item => item !== '');

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
              : this._stringifyLogs(args[index]) // stringify arg
            : ' '), // add space if no arg after string
        // initial accumulator value
        '',
      );
    } else {
      // this block means arguments syntax is used (syntax like $('text', someVar))
      // in this case strings represents just a first argument
      logs = this._stringifyLogs(strings, ...args);
    }
    this._originalUserLogger.log(logs);
    this.dataStorage.putData(logs, context);
  }

  /**
   * This function is a wrapper for all logging methods (not to repeat the same code)
   * @param {*} argsArray
   * @param {*} level
   * @returns
   */
  _logWrapper(argsArray, level) {
    if (!argsArray.length) return;

    // entity which is used to define testId
    let context = null;
    // last argument could contain testId
    const testId = this._helpers.parseLastArgToGetTestId(...argsArray);
    if (testId) {
      // last arg is test id, do not log it
      context = argsArray.pop();
    }

    const severity = LEVELS[level].severity;
    if (severity < LEVELS[this.logLevel]?.severity) return;

    const logs = this._stringifyLogs(...argsArray);
    const colorizedLogs = chalk[LEVELS[level].color](logs);
    this.dataStorage.putData(colorizedLogs, context);
    try {
      // level.toLowerCase() represents method name (log, warn, error, etc)
      this._originalUserLogger[level.toLowerCase()](colorizedLogs);
    } catch (e) {
      // method could be unexisting, ignore error
    }
  }

  assert(...args) {
    // sometimes user invokes logger without any arguments passed
    if (!args.length) return;

    const level = 'ERROR';
    const severity = LEVELS[level].severity;
    if (severity < LEVELS[this.logLevel]?.severity) return;

    const logs = this._stringifyLogs(...args);
    this.dataStorage.putData(logs);
    try {
      this._originalUserLogger.log(`Assertion result: `, ...args);
    } catch (e) {
      // method could be unexisting, ignore error
    }
  }

  debug(...args) {
    this._logWrapper(args, 'DEBUG');
  }

  error(...args) {
    this._logWrapper(args, 'ERROR');
  }

  info(...args) {
    this._logWrapper(args, 'INFO');
  }

  log(...args) {
    this._logWrapper(args, 'LOG');
  }

  trace(...args) {
    this._logWrapper(args, 'TRACE');
  }

  warn(...args) {
    this._logWrapper(args, 'WARN');
  }

  /**
   * Intercepts user logger messages.
   * When call this method, Logger start to control the user logger,
   * but almost nothing is changed for user regarding the console output (like log level set by user)
   * (until multiple loggers are intercepted,
   * in this case only the last intercepted logger will be used as user console output).
   * @param {*} userLogger
   */
  intercept(userLogger) {
    if (!userLogger) return;

    /* prevent multiple console interceptions (cause infinite loop)
    actual only for "console", because its used as default output and is intercepted by default */
    const isUserLoggerConsole = userLogger.toString?.().toLowerCase() === '[object console]';
    if (isUserLoggerConsole && process.env.TESTOMATIO_LOGGER_CONSOLE_INTERCEPTED) {
      debug(`Try to intercept console, but it is already intercepted`);
      return;
    }
    // prevent other loggers multiple interceptions
    if (_.isEqual(userLogger, this._originalUserLogger)) {
      debug(`Try to intercept user logger, but it is already intercepted`);
      return;
    }

    process.env.TESTOMATIO_LOGGER_CONSOLE_INTERCEPTED = 'true';
    debug(isUserLoggerConsole ? 'console intercepted' : 'User logger intercepted');

    /* logs could be intercepted for playwright only if console provides output, thus adding this exception.
    it means default _originalUserLogger (console by default) will be used to provide output
    (for other frameworks user logger will be passed for output) */
    if (this.dataStorage.runningEnvironment !== 'playwright') {
      // save original user logger to use it for logging (last intercepted will be used for console output)
      //! TODO: temporary don't oeverride user logger to prevent recursion; console will be used for output
      // this._originalUserLogger = { ...userLogger };
    }
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
const logger = new Logger();

module.exports = logger;

// TODO: parse passed arguments as {level: 'str', message: 'str'} because some loggers use such syntax;
// upd: did not face such loggers, but still could be useful
