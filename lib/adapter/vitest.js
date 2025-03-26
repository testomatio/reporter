const chalk = require('chalk');
const { TestomatioClient } = require('../client');
const { STATUS } = require('../constants');
const { getTestomatIdFromTestTitle } = require('../utils/utils');
const debug = require('debug')('@testomatio/reporter:adapter:vitest');

/**
 * @typedef {import('../../types').VitestTest} VitestTest
 * @typedef {import('../../types').VitestTestFile} VitestTestFile
 * @typedef {import('../../types').VitestSuite} VitestSuite
 * @typedef {import('../../types').VitestTestLogs} VitestTestLogs
 * @typedef {import('../../vitest.types').ErrorWithDiff} ErrorWithDiff
 * @typedef {typeof import('../constants').STATUS} STATUS
 * @typedef {import('../../types').TestData} TestData
 */

class VitestReporter {
  constructor(config = {}) {
    this.client = new TestomatioClient({ apiKey: config?.apiKey });
    /**
     * @type {(TestData & {status: string})[]} tests
     */
    this.tests = [];
  }

  // on run start
  onInit() {
    this.client.createRun();
  }

  /**
   * @param {VitestTestFile[] | undefined} files // array with results;
   * @param {unknown[] | undefined} errors // errors does not contain errors from tests; probably its testrunner errors
   */
  async onFinished(files, errors) {
    if (!files || !files.length) console.info('No tests executed');

    files.forEach(file => {
      // task could be test or suite
      file.tasks.forEach(taskOrSuite => {
        if (taskOrSuite.type === 'test') {
          const test = taskOrSuite;
          this.tests.push(this.#getDataFromTest(test));
        } else if (taskOrSuite.type === 'suite') {
          const suite = taskOrSuite;
          this.#processTasksOfSuite(suite);
        } else {
          throw new Error('Unprocessed case. Unknown task type');
        }
      });
    });

    debug(this.tests.length, 'tests collected');

    // send tests to Testomat.io
    for (const test of this.tests) {
      await this.client.addTestRun(test.status, test);
    }

    console.log('finished');
    if (errors.length) console.error('Vitest adapter errors:', errors);

    await this.client.updateRunStatus(getRunStatusFromResults(files));
  }

  /* non-used listeners
  onUserConsoleLog(log) {}
  onPathsCollected(paths) {} // paths array to files with tests
  onCollected(files) {} // files array with tests (but without results)
  onTaskUpdate(packs) {} // some updates come here on afterAll block execution
  onTestRemoved(trigger) {}
  onWatcherStart(files, errors) {}
  onWatcherRerun(files, trigger) {}
  onServerRestart(reason) {}
  onProcessTimeout() {}
  */

  /**
   * Recursively gets all tasks from suite and pushes them to "tests" array
   *
   * @param {VitestSuite} suite
   */
  #processTasksOfSuite(suite) {
    suite.tasks.forEach(taskOrSuite => {
      if (taskOrSuite.type === 'test') {
        const test = taskOrSuite;
        this.tests.push(this.#getDataFromTest(test));
      } else if (taskOrSuite.type === 'suite') {
        const theSuite = taskOrSuite;
        this.#processTasksOfSuite(theSuite);
      } else {
        throw new Error('Unprocessed case. Unknown task type');
      }
    });
  }

  /**
   * Processes task and returns test data ready to be sent to Testomat.io
   *
   * @param {VitestTest} test
   *
   * @returns {TestData & {status: string}}
   */
  #getDataFromTest(test) {
    return {
      error: test.result?.errors ? test.result.errors[0] : undefined,
      file: test.file.name,
      logs: test.logs ? transformLogsToString(test.logs) : '',
      meta: test.meta,
      status: getTestStatus(test),
      suite_title: test.suite.name || test.file?.name,
      test_id: getTestomatIdFromTestTitle(test.name),
      time: test.result?.duration || 0,
      title: test.name,
      // testomatio functions (artifacts, logs, steps, meta) are not supported
    };
  }
}

/**
 * Returns run status based on test results
 *
 * @param {VitestTestFile[]} files
 * @returns {'passed' | 'failed' | 'finished'}
 */
function getRunStatusFromResults(files) {
  /**
   * @type {'passed' | 'failed' | 'finished'}
   */
  let status = 'finished'; // default status (if no failed or passed tests)

  files.forEach(file => {
    // search for failed tests
    file.tasks.forEach(taskOrSuite => {
      if (taskOrSuite.result?.state === 'fail') {
        status = 'failed'; // set status to failed if any test failed
      }
    });

    // if there are no failed tests > search for passed tests
    if (status !== 'failed') {
      file.tasks.forEach(taskOrSuite => {
        if (taskOrSuite.result?.state === 'pass') {
          status = 'passed'; // set status to passed if any test passed (and there are no failed tests)
        }
      });
    }
  });

  return status;
}

/**
 * Returns test status in Testomat.io format
 *
 * @param {VitestTest} test
 * @returns 'passed' | 'failed' | 'skipped'
 */
function getTestStatus(test) {
  if (test.result?.state === 'fail') return STATUS.FAILED;
  if (test.result?.state === 'pass') return STATUS.PASSED;
  if (!test.result && test.mode === 'skip') return STATUS.SKIPPED;
  console.error(chalk.red('Unprocessed case for defining test status. Contact dev team. Test:'), test);
}

/**
 * @param {VitestTestLogs[]} logs
 * @returns string
 */
function transformLogsToString(logs) {
  if (!logs) return '';
  let logsStr = '';
  logs.forEach(log => {
    if (log.type === 'stdout') logsStr += `${log.content}\n`;
    if (log.type === 'stderr') logsStr += `${chalk.red(log.content)}\n`;
  });
  return logsStr;
}

module.exports.VitestReporter = VitestReporter;
module.exports.default = VitestReporter;
module.exports = VitestReporter;
