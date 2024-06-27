const chalk = require('chalk');
const { TestomatioClient } = require('../client');
const { RunStatus, STATUS } = require('../constants');
const { getTestomatIdFromTestTitle } = require('../utils/utils');
const debug = require('debug')('@testomatio/reporter:adapter:vitest');

/**
 * @typedef {import('../../types').VitestTask} VitestTask
 * @typedef {import('../../types').RunStatus} RunStatus
 * @typedef {import('../../types').VitestTestFile} VitestTestFile
 * @typedef {import('../../types').VitestSuite} VitestSuite
 * @typedef {typeof import('../constants').STATUS} STATUS
 * @typedef {import('../../types').TestData} TestData
 */

class TestomatioReporter {
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

  // paths array to files with tests
  onPathsCollected(paths) {
    console.log('paths collected');
  }

  // files array with tests
  onCollected(files) {
    // file.filepath
    // file.name : test/basics.test.ts
    // file.tasks - array of tests
    console.log('collected');
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
          // task with type "test" is a test
          const test = taskOrSuite;
          this.tests.push(getDataFromTest(test));
        } else if (taskOrSuite.type === 'suite') {
          const suite = taskOrSuite;
          this.#getTasksFromSuite(suite);
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

    this.client.updateRunStatus(getRunStatus(files));
  }

  // smth strange
  // onTaskUpdate(packs) {
  //   console.log('task update')
  // }

  onTestRemoved(trigger) {
    console.log('test removed');
  }

  onWatcherStart(files, errors) {
    console.log('watcher start');
  }

  onWatcherRerun(files, trigger) {
    console.log('watcher rerun');
  }

  onServerRestart(reason) {
    console.log('server restart');
  }

  // gathers console logs
  onUserConsoleLog(log) {
    // console.log('user console log')
  }

  onProcessTimeout() {
    console.log('process timeout');
  }

  /**
   *
   * @param {VitestSuite} suite
   */
  #getTasksFromSuite(suite) {
    suite.tasks.forEach(taskOrSuite => {
      if (taskOrSuite.type === 'test') {
        const test = taskOrSuite;
        this.tests.push(getDataFromTest(test));
      } else if (taskOrSuite.type === 'suite') {
        const suite = taskOrSuite;
        this.#getTasksFromSuite(suite);
      } else {
        throw new Error('Unprocessed case. Unknown task type');
      }
    });
  }
}

/**
 * Processes task and returns test data ready to be sent to Testomat.io
 *
 * @param {VitestTask} test
 */
function getDataFromTest(test) {
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

/**
 * @param {VitestTestFile[]} files
 *
 * @returns {'passed' | 'failed' | 'finished'}
 */
function getRunStatus(files) {
  /**
   * @type {'passed' | 'failed' | 'finished'}
   */
  let status = 'finished';
  files.map(file => {
    // search for failed tests
    file.tasks.map(taskOrSuite => {
      if (taskOrSuite.result?.state === 'fail') {
        status = 'failed';
      }
    });

    // if there are no failed tests > search for passed tests
    if (status !== 'failed') {
      file.tasks.map(taskOrSuite => {
        if (taskOrSuite.result?.state === 'pass') {
          status = 'passed';
        }
      });
    }
  });

  return status;
}

/**
 * @param {VitestTask} test
 * @returns 'passed' | 'failed' | 'skipped'
 */
function getTestStatus(test) {
  if (test.result?.state === 'fail') return STATUS.FAILED;
  if (test.result?.state === 'pass') return STATUS.PASSED;
  if (!test.result && test.mode === 'skip') return STATUS.SKIPPED;
  console.error(chalk.red('Unprocessed case for defining test status. Contact dev team. Test:'), test);
}

module.exports = TestomatioReporter;
module.exports.default = TestomatioReporter;
