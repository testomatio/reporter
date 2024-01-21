const chalk = require('chalk');
const debug = require('debug')('@testomatio/reporter:services-logger');
const { dataStorage } = require('../data-storage');

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

// ! DON'T use console.log, console.warn, etc in this file, because it will lead to infinite loop
// use debug() instead

/**
 * Logger allows to intercept logs from any logger (console.log, tracer, pino, etc)
 * and save in the testomatio reporter.
 * Supports different syntaxes to satisfy any user preferences.
 */
class Logger {
  // set default logger to be used in log, warn, error, etc methods
  #originalUserLogger = { ...console };

  #userLoggerWithOverridenMethods;

  static #instance;

  /**
   *
   * @returns {Logger}
   */
  static getInstance() {
    if (!this.#instance) {
      this.#instance = new Logger();
    }
    return this.#instance;
  }

  logLevel = process?.env?.LOG_LEVEL?.toUpperCase() || 'ALL';

  constructor() {
    if (!dataStorage.isFileStorage || process.env.TESTOMATIO_INTERCEPT_CONSOLE_LOGS) this.intercept(console);
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
    dataStorage.putData('log', logs);
  }

  /**
   *
   * @param {string} context testId or test context from test runner
   * @returns {string[]}
   */
  getLogs(context) {
    const logs = dataStorage.getData('log', context);
    if (!logs) return [];
    return logs;
  }

  #stringifyLogs(...args) {
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
   * 1. Tagget template: log`text ${someVar}`
   * 2. Standard: log(`text ${someVar}`)
   * 3. Standard with multiple arguments: log('text', someVar)
   */
  _templateLiteralLog(strings, ...args) {
    if (Array.isArray(strings)) strings = strings.filter(item => item !== '').map(item => item.trim());
    if (Array.isArray(args)) args = args.filter(item => item !== '');

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
              : this.#stringifyLogs(args[index]) // stringify arg
            : ''),
        // initial accumulator value
        '',
      );
    } else {
      // this block means arguments syntax is used (syntax like $('text', someVar))
      // in this case strings represents just a first argument
      logs = this.#stringifyLogs(strings, ...args);
    }
    this.#originalUserLogger.log(logs);
    dataStorage.putData('log', logs);
  }

  /**
   * This function is a wrapper for each logging methods (log, warn, error etc) (not to repeat the same code)
   * @param {*} argsArray
   * @param {*} level
   * @returns
   */
  #logWrapper(argsArray, level) {
    if (!argsArray.length) return;

    const severity = LEVELS[level].severity;
    if (severity < LEVELS[this.logLevel]?.severity) return;

    const logs = this.#stringifyLogs(...argsArray);

    const colorizedLogs = chalk[LEVELS[level].color](logs);
    // do not attach logs from testomatio reporter itself
    if (!logs.includes('[TESTOMATIO]')) {
      dataStorage.putData('log', colorizedLogs);
    }

    try {
      // level.toLowerCase() represents method name (log, warn, error, etc)
      this.#originalUserLogger[level.toLowerCase()](colorizedLogs);
    } catch (e) {
      // method could be unexisting, ignore error
    }
  }

  assert(...args) {
    this.#logWrapper(args, 'ERROR');
  }

  debug(...args) {
    this.#logWrapper(args, 'DEBUG');
  }

  error(...args) {
    this.#logWrapper(args, 'ERROR');
  }

  info(...args) {
    this.#logWrapper(args, 'INFO');
  }

  log(...args) {
    this.#logWrapper(args, 'LOG');
  }

  trace(...args) {
    this.#logWrapper(args, 'TRACE');
  }

  warn(...args) {
    this.#logWrapper(args, 'WARN');
  }

  /**
   * Intercepts user logger messages.
   * When call this method, Logger start to control the user logger
   * @param {*} userLogger
   */
  intercept(userLogger) {
    // STEP 1: reset previously intercepted logger methods to original
    if (this.#userLoggerWithOverridenMethods) {
      for (const method of LOG_METHODS) {
        this.#userLoggerWithOverridenMethods[method] = this.#originalUserLogger[method];
      }
    }

    // STEP 2: intercept new logger
    this.#originalUserLogger = { ...userLogger };

    const isUserLoggerConsole = userLogger.toString?.().toLowerCase() === '[object console]';
    debug(`Intercepting ${isUserLoggerConsole ? 'console' : 'some user'} logger}`);

    // override user logger (any, e.g. console) methods to intercept log messages
    for (const method of LOG_METHODS) {
      /*
      its better to create method even if it does not exist in user logger;
      on method invocation, we will store the data anyway and catch block will prevent potential errors
      while trying to output the message to terminal
      */
      // if (!this._loggerToIntercept[method]) continue;
      userLogger[method] = (...args) => this[method](...args);
    }

    this.#userLoggerWithOverridenMethods = userLogger;

    /*
    Initial idea was to intercept any logger (tracer, pino, etc),
    intercept message and provide output by the same logger.
    But reality brings some problems: the same messages are intercepted multiple times
    (because of multiple loggers are created at the same terminal process).
    Also its difficult to understand (actually did not find the way to do it) if logger was already intercepted or not.
    Thus, decided to intercept only console by default and provide output by default console.
    It means, if user uses his own logger, its messages will be intercepted,
    but the output will be always provided by console.
    TODO: try to implement the providing output to terminal by user logger
    */
  }

  stopInterception() {
    debug('Stop ntercepting logs');

    // restore original user logger
    if (this.#userLoggerWithOverridenMethods) {
      for (const method of LOG_METHODS) {
        this.#userLoggerWithOverridenMethods[method] = this.#originalUserLogger[method];
      }
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
    if (config.prettyObjects === false || config.prettyObjects === true) this.prettyObjects = config.prettyObjects;
    if (config.logLevel) this.logLevel = config.logLevel.toUpperCase();
  }
}

module.exports.logger = Logger.getInstance();

// TODO: parse passed arguments as {level: 'str', message: 'str'} because some loggers use such syntax;
// upd: did not face such loggers, but still could be useful

/* Cypress
There is no listener like "after:test" in cypress, only "after:spec" is available.
Thus, cannot separate logs even when I gather them (because I don't know when the test is done, just know about suite).
Also there is no easy way to access the message from cy.log() function.
(Using testomatio logger – logger.log() is not convenient because Cypress chains its commands,
thus such command will interrupt the chain.)

(Could not implement intercepting of cy.log('message'));
I found the only ability to get any logs using .task('log', 'message') (this is custom, not default cypress command)
and then intercept it with:
  on('task', {
    log (message) {
      return null
    }
  })

but:
1) it does not solve problem with getting current running testId;
2) leads to warning "Warning: Multiple attempts to register the following task(s):".)

My way to get test id:
add cypress command to save test title to file)):
  Cypress.Commands.add('writeTestTitleToFile', () => {
    const testTitle = cy.state('runnable').title;
    cy.writeFile('testomatio_test_title', testTitle);
  });

Finally, in the test it will look like:
    cy
      .writeTestTitleToFile() // <<<
      .task('log', 'This is a log message from the test') // <<<

      .get('element)
      .type('text')
      .click()


Parallelization in Cypress is only available if using Cypress Dashboard??
*/

// TODO: add time to logs
// TODO: add logger name to logs?
