import { default as WDIOReporter, RunnerStats } from '@wdio/reporter';
import TestomatClient from '../client.js';
import { getTestomatIdFromTestTitle, fileSystem } from '../utils/utils.js';
import { services } from '../services/index.js';
import { TESTOMAT_TMP_STORAGE_DIR } from '../constants.js';
import { stringToMD5Hash } from '../data-storage.js';

class WebdriverReporter extends WDIOReporter {
  constructor(options) {
    super(options);

    this.client = new TestomatClient({ apiKey: options?.apiKey });
    options = Object.assign(options, { stdout: true });

    this._addTestPromises = [];

    this._isSynchronising = false;

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

  // wdio-cucumber does not trigger onTestEnd hook, thus, using this one
  onSuiteEnd(scerario) {
    if (scerario.type === 'scenario') {
      this._addTestPromises.push(this.addBddScenario(scerario));
    }
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
