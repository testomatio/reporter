// eslint-disable-next-line global-require, import/no-extraneous-dependencies
const WDIOReporter = require('@wdio/reporter').default;
const TestomatClient = require('../client');
const { getTestomatIdFromTestTitle, fileSystem } = require('../utils/utils');
const { services } = require('../services');
const { TESTOMAT_TMP_STORAGE_DIR } = require('../constants');

class WebdriverReporter extends WDIOReporter {
  constructor(options) {
    super(options);

    this.client = new TestomatClient({ apiKey: options?.apiKey });
    options = Object.assign(options, { stdout: true });

    this._addTestPromises = [];

    this._isSynchronising = false;
  }

  onRunnerStart() {
    // clear dir with artifacts/logs
    fileSystem.clearDir(TESTOMAT_TMP_STORAGE_DIR);
  }

  onTestStart(test) {
    services.setContext(test.fullTitle);
  }

  get isSynchronised() {
    return this._isSynchronising === false;
  }

  async onRunnerEnd() {
    this._isSynchronising = true;

    await Promise.all(this._addTestPromises);

    this._isSynchronising = false;
  }

  onTestEnd(test) {
    test.suite = test.parent;
    const logs = getTestLogs(test.fullTitle);
    // TODO: FIX: artifacts for some reason leads to empty report on Testomat.io
    // const artifacts = services.artifacts.get(test.fullTitle);
    // const keyValues = services.keyValues.get(test.fullTitle);
    test.logs = logs;
    // test.artifacts = artifacts;
    // test.meta = keyValues;
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

    const { title, _duration: duration, state, error, output } = test;

    const testId = getTestomatIdFromTestTitle(title);

    const screenshotEndpoint = '/session/:sessionId/screenshot';
    const screenshotsBuffers = output
      .filter(el => el.endpoint === screenshotEndpoint && el.result && el.result.value)
      .map(el => Buffer.from(el.result.value, 'base64'));

    await this.client.addTestRun(state, {
      manuallyAttachedArtifacts: test.artifacts,
      error,
      logs: test.logs,
      meta: test.meta,
      title,
      test_id: testId,
      time: duration,
      filesBuffers: screenshotsBuffers,
    });
  }

  /**
   * @param {import('../../types').WebdriverIOScenario} scenario
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

module.exports = WebdriverReporter;
