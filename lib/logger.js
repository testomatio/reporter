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
 * Logger allows to intercept logs from any logger (console.log, tracer, pino, etc)
 * and save in the testomatio reporter.
 * Supports different syntaxes to satisfy any user preferences.
 */
class Logger {
  // set default logger to be used in log, warn, error, etc methods
  #originalUserLogger = { ...console };
  #dataStorage = new DataStorage('log');
  logLevel = process?.env?.LOG_LEVEL?.toUpperCase() || 'ALL';

  constructor() {
    // intercept console by default
    this.intercept(console);

    // singleton
    if (!Logger.instance) {
      Logger.instance = this;
    }

    // add beforeEach hook for mocha. it does not override existing hook, just add new one
    try {
      // @ts-ignore
      if (!beforeEach) return;
      // @ts-ignore
      beforeEach(function () {
        if (this.currentTest?.__mocha_id__) {
          global.testTitle = this.currentTest.fullTitle();
        }
      });
    } catch (e) {
      // ignore
    }
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
    this.#dataStorage.putData(logs);
  }

  /**
   *
   * @param {*} context testId or test context from test runner
   * @returns
   */
  getLogs(context) {
    const logs = this.#dataStorage.getData(context);
    return logs || '';
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
  _log(strings, ...args) {
    // console.log('strings', strings);
    // console.log('args', args);
    if (Array.isArray(strings)) strings = strings.filter(item => item !== '').map(item => item.trim());
    if (Array.isArray(args)) args = args.filter(item => item !== '');
    // entity which is used to define testId
    let context = null;

    // get testId for mocha
    context = global.testTitle ?? null;

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
    this.#dataStorage.putData(logs, context);
  }

  /**
   * This function is a wrapper for each logging methods (log, warn, error etc) (not to repeat the same code)
   * @param {*} argsArray
   * @param {*} level
   * @returns
   */
  #logWrapper(argsArray, level) {
    if (!argsArray.length) return;

    // entity which is used to define testId
    let context = null;

    // get context for mocha
    context = global.testTitle ?? null;

    const severity = LEVELS[level].severity;
    if (severity < LEVELS[this.logLevel]?.severity) return;

    const logs = this.#stringifyLogs(...argsArray);
    const colorizedLogs = chalk[LEVELS[level].color](logs);
    this.#dataStorage.putData(colorizedLogs, context);
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
    if (!userLogger) return;

    /* prevent multiple console interceptions (cause of infinite loop)
    actual only for "console", because its used as default output and is intercepted by default */
    const isUserLoggerConsole = userLogger.toString?.().toLowerCase() === '[object console]';
    if (isUserLoggerConsole && process.env.TESTOMATIO_LOGGER_CONSOLE_INTERCEPTED) {
      debug(`Try to intercept console, but it is already intercepted`);
      return;
    }
    // prevent other loggers multiple interceptions
    // TODO: check with different loggers
    if (Object.keys(userLogger) === Object.keys(this.#originalUserLogger)) {
      debug(`Try to intercept user logger, but it is already intercepted`);
      return;
    }

    process.env.TESTOMATIO_LOGGER_CONSOLE_INTERCEPTED = 'true';
    debug(isUserLoggerConsole ? 'console intercepted' : 'User logger intercepted');

    /* logs could be intercepted for playwright only if console provides output, thus adding this exception.
    it means default _originalUserLogger (console by default) will be used to provide output
    (for other frameworks user logger will be passed for output) */
    if (this.#dataStorage.runningEnvironment !== 'playwright') {
      // save original user logger to use it for logging (last intercepted will be used for console output)
      //! TODO: temporary don't oeverride user logger to prevent recursion; console will be used for output
      // this._originalUserLogger = { ...userLogger };
    }

    // override user logger (any, e.g. console) methods to intercept log messages
    for (const method of LOG_METHODS) {
      /*
      decided to comment next code line because its better to create method even if it does not exist in user logger;
      on method invocation, we will store the data anyway and catch block will prevent potential errors
      */
      // if (!this._loggerToIntercept[method]) continue;
      userLogger[method] = (...args) => this[method](...args);
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

Logger.instance = null;

// module.exports.Logger = Logger;
const logger = new Logger();

module.exports = logger;

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
      console.log(message)
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
*/
