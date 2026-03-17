import pc from 'picocolors';
import { Client as TestomatioClient } from '../client.js';
import { STATUS } from '../constants.js';
import { getTestomatIdFromTestTitle } from '../utils/utils.js';
import createDebugMessages from 'debug';

const debug = createDebugMessages('@testomatio/reporter:adapter-jest');

/**
 * @typedef {import('../../types/types.js').VitestTest} VitestTest
 * @typedef {import('../../types/types.js').VitestTestFile} VitestTestFile
 * @typedef {import('../../types/types.js').VitestSuite} VitestSuite
 * @typedef {import('../../types/types.js').VitestTestLogs} VitestTestLogs
 * @typedef {import('../../types/vitest.types.js').ErrorWithDiff} ErrorWithDiff
 * @typedef {typeof import('../constants.js').STATUS} STATUS
 * @typedef {import('../../types/types.js').TestData} TestData
 */

class VitestReporter {
  constructor(config = {}) {
    this.client = new TestomatioClient({ apiKey: config?.apiKey });
    /**
     * @type {(TestData & {status: string})[]} tests
     */
    this.tests = [];
    this._finalized = false;
    this._finalizing = false;
  }

  // on run start
  onInit() {
    this._finalized = false;
    this._finalizing = false;
    this.client.createRun();
  }

  /**
   * @param {VitestTestFile[] | undefined} files // array with results;
   * @param {unknown[] | undefined} errors // errors does not contain errors from tests; probably its testrunner errors
   */
  async onFinished(files, errors) {
    if (this._finalized || this._finalizing) return;
    this._finalizing = true;

    try {
      this.tests = [];
      if (!files || !files.length) {
        console.info('No tests executed');
        return;
      }

      files.forEach(file => {
        // task could be test or suite
        getTasks(file).forEach(taskOrSuite => {
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
      this._finalized = true;
    } finally {
      this._finalizing = false;
    }
  }

  /**
   * Vitest 4+ reporter API callback.
   *
   * @param {Array<unknown> | undefined} testModules
   * @param {unknown[] | undefined} errors
   */
  async onTestRunEnd(testModules, errors) {
    const files = (testModules || []).map(module => module && (/** @type {any} */ (module).task || module)).filter(Boolean);
    await this.onFinished(files, errors);
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
    getTasks(suite).forEach(taskOrSuite => {
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
   * @returns {TestData & {status: 'passed' | 'failed' | 'skipped'}}
   */
  #getDataFromTest(test) {
    return {
      error: test.result?.errors ? test.result.errors[0] : undefined,
      file: test.file?.name || test.file?.filepath || '',
      logs: test.logs ? transformLogsToString(test.logs) : '',
      meta: test.meta,
      // @ts-ignore - STATUS values are string literals but type system sees them as string
      status: getTestStatus(test),
      suite_title: test.suite?.name || test.file?.name || test.file?.filepath,
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
  if (test.result?.state === 'skip' || (!test.result && test.mode === 'skip')) return STATUS.SKIPPED;
  console.error(pc.red('Unprocessed case for defining test status. Contact dev team. Test:'), test);
  return STATUS.SKIPPED;
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
    if (log.type === 'stderr') logsStr += `${pc.red(log.content)}\n`;
  });
  return logsStr;
}

/**
 * Supports both old and new Vitest task tree shapes.
 *
 * @param {any} node
 * @returns {any[]}
 */
function getTasks(node) {
  if (!node) return [];
  if (Array.isArray(node.tasks)) return node.tasks;
  if (Array.isArray(node.children)) return node.children;
  if (node.task) return [node.task];
  return [];
}

export default VitestReporter;
export { VitestReporter };
