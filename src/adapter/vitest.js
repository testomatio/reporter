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
    /** @type {(TestData & {status: string, _reportKey?: string | null})[]} tests */
    this.tests = [];
    this._finalized = false;
    this._finalizing = false;
    this._runStartedAtMs = null;
    this._runStartedAtMicros = null;
    this._reportedTestKeys = new Set();
    this._liveQueue = Promise.resolve();
  }

  // on run start
  onInit() {
    const now = Date.now();
    this._finalized = false;
    this._finalizing = false;
    this._runStartedAtMs = now;
    this._runStartedAtMicros = now * 1000;
    this._reportedTestKeys = new Set();
    this._liveQueue = Promise.resolve();
    this.client.createRun();
  }

  /**
   * Vitest 3/4 callback fired when test run starts.
   */
  onTestRunStart() {
    const now = Date.now();
    this._runStartedAtMs = now;
    this._runStartedAtMicros = now * 1000;
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
        if (test._reportKey && this._reportedTestKeys.has(test._reportKey)) continue;
        if (test._reportKey) this._reportedTestKeys.add(test._reportKey);
        await this.client.addTestRun(test.status, test);
      }
      await this._liveQueue;

      console.log('finished');
      if (errors.length) console.error('Vitest adapter errors:', errors);

      const startedAtMs = this._runStartedAtMs || getEarliestTestStartMs(files) || Date.now();
      const duration = Math.max(0, (Date.now() - startedAtMs) / 1000);
      await this.client.updateRunStatus(getRunStatusFromResults(files), { duration });
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
    const files = (testModules || [])
      .map(module => module && (/** @type {any} */ (module).task || module))
      .filter(Boolean);
    await this.onFinished(files, errors);
  }

  /**
   * Vitest 4 callback fired when single test case is finished.
   *
   * @param {unknown} testCase
   */
  async onTestCaseResult(testCase) {
    await this.#reportLive(testCase);
  }

  /**
   * Vitest 3 fallback callback with task updates.
   *
   * @param {unknown[] | undefined} packs
   */
  async onTaskUpdate(packs) {
    if (!Array.isArray(packs) || !packs.length) return;
    for (const pack of packs) {
      const test = getTestFromTaskUpdatePack(pack);
      if (test) await this.#reportLive(test);
    }
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
   * @param {any} test
   *
   * @returns {TestData & {status: 'passed' | 'failed' | 'skipped', _reportKey?: string | null}}
   */
  #getDataFromTest(test) {
    const normalized = normalizeVitestTest(test);
    const reportKey = getReportKey(test, normalized);
    const startMicros =
      typeof normalized.startTime === 'number'
        ? Math.floor(normalized.startTime * 1000)
        : this._runStartedAtMicros || undefined;

    return {
      _reportKey: reportKey,
      error: normalized.error,
      file: normalized.file,
      logs: normalized.logs,
      meta: normalized.meta,
      // @ts-ignore - STATUS values are string literals but type system sees them as string
      status: getTestStatus(normalized.state, normalized.mode),
      suite_title: normalized.suiteTitle,
      test_id: getTestomatIdFromTestTitle(normalized.name),
      time: normalized.duration,
      timestamp: startMicros,
      title: normalized.name,
      // testomatio functions (artifacts, logs, steps, meta) are not supported
    };
  }

  /**
   * @param {unknown} testCase
   */
  async #reportLive(testCase) {
    if (this._finalized || this._finalizing) return;
    const normalized = normalizeVitestTest(testCase);
    if (!isLiveReportableState(normalized.state, normalized.mode)) return;

    const data = this.#getDataFromTest(testCase);
    if (!data._reportKey || this._reportedTestKeys.has(data._reportKey)) return;
    this._reportedTestKeys.add(data._reportKey);

    this._liveQueue = this._liveQueue
      .then(() => this.client.addTestRun(data.status, data))
      .catch(() => undefined);
    await this._liveQueue;
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
    getTasks(file).forEach(taskOrSuite => {
      if (isFailedState(taskOrSuite?.result?.state)) {
        status = 'failed'; // set status to failed if any test failed
      }
    });

    // if there are no failed tests > search for passed tests
    if (status !== 'failed') {
      getTasks(file).forEach(taskOrSuite => {
        if (isPassedState(taskOrSuite?.result?.state)) {
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
 * @param {string | undefined} state
 * @param {string | undefined} mode
 * @returns 'passed' | 'failed' | 'skipped'
 */
function getTestStatus(state, mode) {
  if (isFailedState(state)) return STATUS.FAILED;
  if (isPassedState(state)) return STATUS.PASSED;
  if (isSkippedState(state) || (!state && mode === 'skip')) return STATUS.SKIPPED;
  console.error(pc.red('Unprocessed case for defining test status. Contact dev team. State:'), state);
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
  if (node.children && typeof node.children[Symbol.iterator] === 'function') return Array.from(node.children);
  if (node.task) return [node.task];
  return [];
}

/**
 * @param {string | undefined} state
 * @returns {boolean}
 */
function isFailedState(state) {
  return state === 'fail' || state === 'failed';
}

/**
 * @param {string | undefined} state
 * @returns {boolean}
 */
function isPassedState(state) {
  return state === 'pass' || state === 'passed';
}

/**
 * @param {string | undefined} state
 * @returns {boolean}
 */
function isSkippedState(state) {
  return state === 'skip' || state === 'skipped' || state === 'todo';
}

/**
 * Accept only completed test states for live upload to avoid reporting
 * intermediate task updates as skipped.
 *
 * @param {string | undefined} state
 * @param {string | undefined} mode
 * @returns {boolean}
 */
function isLiveReportableState(state, mode) {
  if (isFailedState(state) || isPassedState(state) || isSkippedState(state)) return true;
  if (!state && mode === 'skip') return true;
  return false;
}

/**
 * @param {VitestTestFile[] | undefined} files
 * @returns {number | null}
 */
function getEarliestTestStartMs(files) {
  let earliest = null;
  const walk = node => {
    if (!node) return;
    const startTime = node?.result?.startTime;
    if (typeof startTime === 'number' && !Number.isNaN(startTime)) {
      if (earliest == null || startTime < earliest) earliest = startTime;
    }
    getTasks(node).forEach(walk);
  };
  (files || []).forEach(walk);
  return earliest;
}

/**
 * @param {any} test
 * @returns {{
 *  name: string,
 *  state: string | undefined,
 *  mode: string | undefined,
 *  duration: number,
 *  startTime: number | undefined,
 *  error: any,
 *  file: string,
 *  suiteTitle: string,
 *  logs: string,
 *  meta: any
 * }}
 */
function normalizeVitestTest(test) {
  if (test && typeof test.result === 'function') {
    const result = test.result();
    const diagnostic = typeof test.diagnostic === 'function' ? test.diagnostic() : undefined;
    const state = result?.state;
    const duration = diagnostic?.duration || 0;
    const startTime = diagnostic?.startTime;
    const error = Array.isArray(result?.errors) ? result.errors[0] : undefined;
    const file =
      test.module?.relativeModuleId ||
      test.module?.moduleId ||
      test.task?.file?.name ||
      test.task?.file?.filepath ||
      '';
    const suiteTitle =
      (test.parent?.type === 'suite' ? test.parent?.name : null) ||
      test.task?.suite?.name ||
      test.task?.file?.name ||
      file;

    return {
      name: test.name || test.task?.name || '',
      state,
      mode: test.options?.mode || test.task?.mode,
      duration,
      startTime,
      error,
      file,
      suiteTitle,
      logs: '',
      meta: typeof test.meta === 'function' ? test.meta() : {},
    };
  }

  return {
    name: test?.name || '',
    state: test?.result?.state,
    mode: test?.mode,
    duration: test?.result?.duration || 0,
    startTime: test?.result?.startTime,
    error: test?.result?.errors ? test.result.errors[0] : undefined,
    file: test?.file?.name || test?.file?.filepath || '',
    suiteTitle: test?.suite?.name || test?.file?.name || test?.file?.filepath || '',
    logs: test?.logs ? transformLogsToString(test.logs) : '',
    meta: test?.meta,
  };
}

/**
 * @param {any} test
 * @param {{file: string, suiteTitle: string, name: string, startTime?: number}} normalized
 * @returns {string | null}
 */
function getReportKey(test, normalized) {
  if (test?.id) return String(test.id);
  if (test?.task?.id) return String(test.task.id);
  if (!normalized?.name) return null;
  const loc = test?.location || test?.task?.location;
  const locationKey = loc ? `${loc.line || ''}:${loc.column || ''}` : '';
  const startKey =
    typeof normalized.startTime === 'number' && !Number.isNaN(normalized.startTime) ? String(normalized.startTime) : '';
  return `${normalized.file}::${normalized.suiteTitle}::${normalized.name}::${locationKey}::${startKey}`;
}

/**
 * Vitest can pass task updates as tuples. Try to extract a test-like object.
 *
 * @param {unknown} pack
 * @returns {any | null}
 */
function getTestFromTaskUpdatePack(pack) {
  if (!pack) return null;

  if (Array.isArray(pack)) {
    if (pack[2]?.type === 'test') return pack[2];
    if (pack[1]?.type === 'test') return pack[1];
    if (pack[0]?.type === 'test') return pack[0];
    return null;
  }

  const objectPack = /** @type {any} */ (pack);
  if (typeof objectPack === 'object' && objectPack?.type === 'test') return objectPack;
  return null;
}

export default VitestReporter;
export { VitestReporter };
