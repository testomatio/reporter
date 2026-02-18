import { default as WDIOReporter, RunnerStats } from '@wdio/reporter';
import TestomatClient from '../client.js';
import { getTestomatIdFromTestTitle, fileSystem } from '../utils/utils.js';
import { services } from '../services/index.js';
import { TESTOMAT_TMP_STORAGE_DIR } from '../constants.js';
import { stringToMD5Hash } from '../data-storage.js';
import * as parser from '@babel/parser';
import _traverse from '@babel/traverse';
import * as fs from 'fs';
import * as path from 'path';

class WebdriverReporter extends WDIOReporter {
  constructor(options) {
    super(options);

    this.client = new TestomatClient({ apiKey: options?.apiKey });
    options = Object.assign(options, { stdout: true });

    this._addTestPromises = [];

    this._isSynchronising = false;

    // Track hook failures with their suites
    this.hookFailures = {};

    // run is created by cli, if enabling the row below, it mat lead to multiple runs being created
    // thus, need to check if process.env.runId is set and/or add more checks to avoid creating multiple runs
    // this.client.createRun();
  }

  get isSynchronised() {
    return this._isSynchronising === false;
  }

  /**
   *
   * @param {RunnerStats} runData
   */
  async onRunnerEnd(runData) {
    this._isSynchronising = true;

    await Promise.all(this._addTestPromises);

    this._isSynchronising = false;

    // NOTE: new functionality; may break everything
    // also this may require additional status mapping
    await this.client.updateRunStatus(runData.failures ? 'failed' : 'passed');
  }

  onRunnerStart() {
    // clear dir with artifacts/logs
    fileSystem.clearDir(TESTOMAT_TMP_STORAGE_DIR);
  }

  onHookEnd(hook) {
    // Check if this is a before each hook that failed
    const isBeforeEach = hook.title && hook.title.includes('before each');

    if (isBeforeEach && hook.errors && hook.errors.length > 0) {
      if (!this.hookFailures[hook.parent]) {
        this.hookFailures[hook.parent] = {
          error: hook.errors[0],
          suiteTitle: hook.parent,
        };
      }
    }
  }

  async onSuiteEnd(suiteOrScenario) {
    // Handle hook failures for regular suites
    if (suiteOrScenario.type !== 'scenario') {
      if (this.hookFailures[suiteOrScenario.fullTitle]) {
        const { error, suiteTitle } = this.hookFailures[suiteOrScenario.fullTitle];

        const allTestTitles = extractTestsFromSpecFile(suiteOrScenario.file);

        const ranTestTitles = new Set((suiteOrScenario.tests || []).map(t => t.title));

        for (const testTitle of allTestTitles) {
          if (!ranTestTitles.has(testTitle)) {
            await this.client.addTestRun('failed', {
              error,
              suite_title: suiteTitle,
              title: testTitle,
              test_id: getTestomatIdFromTestTitle(testTitle),
              time: 0,
            });
          }
        }

        if (suiteOrScenario.tests) {
          for (const test of suiteOrScenario.tests) {
            if (!test.state || test.state === 'skipped' || test.state === 'pending') {
              await this.client.addTestRun('failed', {
                error,
                suite_title: suiteTitle,
                title: test.title,
                test_id: getTestomatIdFromTestTitle(test.title),
                time: 0,
              });
            }
          }
        }

        delete this.hookFailures[suiteOrScenario.fullTitle];
      }
    }

    if (suiteOrScenario.type === 'scenario') {
      this._addTestPromises.push(this.addBddScenario(suiteOrScenario));
    }
  }

  onTestStart(test) {
    services.setContext(test.fullTitle);
  }

  onTestEnd(test) {
    test.suite = test.parent;
    const logs = getTestLogs(test.fullTitle);

    test.artifacts = services.artifacts.get(test.fullTitle);
    test.meta = services.keyValues.get(test.fullTitle);
    test.links = services.links.get(test.fullTitle);
    test.logs = logs;

    this._addTestPromises.push(this.addTest(test));
  }

  async addTest(test) {
    if (!this.client) return;

    const { title, _duration: duration, state, error, output, links, artifacts, meta, logs } = test;

    const testId = getTestomatIdFromTestTitle(title);

    const screenshotEndpoint = '/session/:sessionId/screenshot';
    const screenshotsBuffers = output
      .filter(el => el.endpoint === screenshotEndpoint && el.result && el.result.value)
      .map(el => Buffer.from(el.result.value, 'base64'));

    const rid = stringToMD5Hash(test.fullTitle);

    await this.client.addTestRun(state, {
      rid,
      manuallyAttachedArtifacts: test.artifacts,
      error,
      logs,
      meta,
      links,
      title,
      test_id: testId,
      time: duration,
      filesBuffers: screenshotsBuffers,
    });
  }

  /**
   * @param {import('../../types/types.js').WebdriverIOScenario} scenario
   */
  addBddScenario(scenario) {
    if (!this.client) return;

    const { title, _duration: duration } = scenario;

    const testId = getTestomatIdFromTestTitle(title || scenario.tags.map(tag => tag.name).join(' '));

    let scenarioState = scenario.tests.every(test => test.state === 'passed') ? 'passed' : 'failed';
    if (scenario.tests.every(test => test.state === 'skipped')) {
      scenarioState = 'skipped';
    }
    const errors = scenario.tests
      .filter(test => test.state === 'failed')
      .map(test => test.error?.stack)
      .filter(Boolean);
    const error = errors.join('\n');

    const tags = scenario.tags.map(tag => tag.name);

    return this.client.addTestRun(scenarioState, {
      error: error ? Error(error) : null,
      title,
      test_id: testId,
      time: duration,
      tags,
      file: scenario.file,
      // filesBuffers: screenshotsBuffers,
    });
  }
}

/**
 * Extract all test titles from a spec file using AST parsing
 * @param {string} filePath - Path to the test file
 * @returns {string[]} Array of test titles
 */
function extractTestsFromSpecFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return [];
    }

    const code = fs.readFileSync(filePath, 'utf-8');
    const ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
    });

    const tests = [];

    _traverse(ast, {
      CallExpression(path) {
        if (
          path.node.callee.type === 'Identifier' &&
          path.node.callee.name === 'it' &&
          path.node.arguments.length >= 1 &&
          path.node.arguments[0].type === 'StringLiteral'
        ) {
          tests.push(path.node.arguments[0].value);
        }
      },
    });

    return tests;
  } catch (error) {
    console.error('[TESTOMATIO] Error parsing spec file:', error.message);
    return [];
  }
}

/**
 *
 * @param {*} fullTestTitle
 * @returns string
 */
function getTestLogs(fullTestTitle) {
  const logsArr = services.logger.getLogs(fullTestTitle);
  // remove duplicates (for some reason, logs are duplicated several times)
  const logs = logsArr ? Array.from(new Set(logsArr)).join('\n').trim() : '';
  return logs;
}

export default WebdriverReporter;

/* INVESTIGATION RESULTS:
  If you run tests in parallel, the WDIO creates a separate process for each parallel instance.
  As a result, there is own WDIOReporter instance for each parallel process.
  This means, its impossible to create or finish run, because can't understand if its was already created
  in other process or not.
*/
