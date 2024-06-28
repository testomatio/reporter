const chalk = require('chalk');
const { TestomatioClient } = require('../client');
const { STATUS } = require('../constants');
const { getTestomatIdFromTestTitle } = require('../utils/utils');
const debug = require('debug')('@testomatio/reporter:adapter:vitest');

/**
 * @typedef {import('../../types').VitestTask} VitestTask
 * @typedef {import('../../types').VitestTestFile} VitestTestFile
 * @typedef {import('../../types').VitestSuite} VitestSuite
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
  onInit(ctx) {
    this.client.createRun();
  }

  /**
   * @param {VitestTestFile[]} files
   * @param {*} errors
   */
  async onFinished(files, errors) {
    // files  - array with results;
    // errors does not contain errors from tests; probably its testrunner errors

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

  onUserConsoleLog(log) {}

  /* non-used listeners
  onPathsCollected(paths) {} // paths array to files with tests
  onCollected(files) {} // files array with tests (but without results)
  onTaskUpdate(packs) {}
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
        const suite = taskOrSuite;
        this.#processTasksOfSuite(suite);
      } else {
        throw new Error('Unprocessed case. Unknown task type');
      }
    });
  }

  /**
   * Processes task and returns test data ready to be sent to Testomat.io
   *
   * @param {VitestTask} test
   */
  #getDataFromTest(test) {
    return {
      error: test.result?.errors?.[0] || null,
      file: test.file.name,
      logs: test.logs?.join('\n') || '',
      // manuallyAttachedArtifacts,
      meta: test.meta,
      status: getTestStatus(test),
      // steps:
      suite_title: test.suite.name,
      test_id: getTestomatIdFromTestTitle(test.name),
      time: test.result?.duration || 0,
      title: test.name,
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

  files.map(file => {
    // search for failed tests
    file.tasks.map(taskOrSuite => {
      if (taskOrSuite.result?.state === 'fail') {
        status = 'failed'; // set status to failed if any test failed
      }
    });

    // if there are no failed tests > search for passed tests
    if (status !== 'failed') {
      file.tasks.map(taskOrSuite => {
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
 * @param {VitestTask} test
 * @returns 'passed' | 'failed' | 'skipped'
 */
function getTestStatus(test) {
  if (test.result?.state === 'fail') return STATUS.FAILED;
  if (test.result?.state === 'pass') return STATUS.PASSED;
  if (!test.result && test.mode === 'skip') return STATUS.SKIPPED;
  console.error(chalk.red('Unprocessed case for defining test status. Contact dev team. Test:'), test);
}

module.exports.VitestReporter = VitestReporter;
module.exports.default = VitestReporter;
module.exports = VitestReporter;
