// eslint-disable-next-line global-require, import/no-extraneous-dependencies
const WDIOReporter = require('@wdio/reporter').default;
const TestomatClient = require('../client');
const { parseTest } = require('../utils/utils');

class WebdriverReporter extends WDIOReporter {
  constructor(options) {
    super(options);

    this.client = new TestomatClient({ apiKey: options?.apiKey });
    options = Object.assign(options, { stdout: true });

    this._addTestPromises = [];

    this._isSynchronising = false;
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
    this._addTestPromises.push(this.addTest(test));
  }

  // wdio-cucumber does not trigger onTestEnd hook, thus, using this one
  /**
   * 
   * @param {} scerario 
   * @returns 
   */
  onSuiteEnd(scerario) {
    if (scerario.type !== 'scenario') return;
    console.log(scerario);
    this._addTestPromises.push(this.addTest(scerario));
  }


  async addTest(test) {
    if (!this.client) return;

    const { title, _duration: duration, state, error, output } = test;

    const testId = parseTest(title);

    const screenshotEndpoint = '/session/:sessionId/screenshot';
    const screenshotsBuffers = output
      .filter(el => el.endpoint === screenshotEndpoint && el.result && el.result.value)
      .map(el => Buffer.from(el.result.value, 'base64'));

    await this.client.addTestRun(state, {
      error,
      title,
      test_id: testId,
      time: duration,
      filesBuffers: screenshotsBuffers,
    });
  }

  // {"type":"scenario","start":"2024-03-22T15:51:11.371Z","end":"2024-03-22T15:51:11.378Z","_duration":7,"uid":"0","cid":"0-0","file":"/Users/oleksandrpelykh/projects/testomat.io/examples/wdio/cucumber/src/features/addNumbers.feature","title":"Add two positive numbers","fullTitle":"addNumbers.feature:1:1: Add two positive numbers","tags":[],"tests":[{"type":"test","start":"2024-03-22T15:51:11.373Z","end":"2024-03-22T15:51:11.375Z","_duration":2,"uid":"712ac8dd-df43-448f-aa4c-ffa1b1392cd4","cid":"0-0","title":"When I add two numbers 2 and 3","fullTitle":"0: When I add two numbers 2 and 3","output":[],"retries":0,"parent":"0","state":"passed"},{"type":"test","start":"2024-03-22T15:51:11.375Z","end":"2024-03-22T15:51:11.377Z","_duration":2,"uid":"8a8b4c6a-ad35-416b-9fd3-593d1cb9317c","cid":"0-0","title":"Then print result 5","fullTitle":"0: Then print result 5","output":[],"retries":0,"parent":"0","state":"passed"}],"hooks":[{"type":"hook","start":"2024-03-22T15:51:11.371Z","end":"2024-03-22T15:51:11.372Z","_duration":1,"uid":"a1b84a3b-0c50-4edf-9ec9-cca2118643e4","cid":"0-0","title":"","parent":"0","errors":[]},{"type":"hook","start":"2024-03-22T15:51:11.377Z","end":"2024-03-22T15:51:11.377Z","_duration":0,"uid":"654d188c-3e50-4d42-b347-6375b31fd2cb","cid":"0-0","title":"","parent":"0","errors":[]}],"suites":[],"parent":"addNumbers.feature:1:1","hooksAndTests":[{"type":"hook","start":"2024-03-22T15:51:11.371Z","end":"2024-03-22T15:51:11.372Z","_duration":1,"uid":"a1b84a3b-0c50-4edf-9ec9-cca2118643e4","cid":"0-0","title":"","parent":"0","errors":[]},{"type":"test","start":"2024-03-22T15:51:11.373Z","end":"2024-03-22T15:51:11.375Z","_duration":2,"uid":"712ac8dd-df43-448f-aa4c-ffa1b1392cd4","cid":"0-0","title":"When I add two numbers 2 and 3","fullTitle":"0: When I add two numbers 2 and 3","output":[],"retries":0,"parent":"0","state":"passed"},{"type":"test","start":"2024-03-22T15:51:11.375Z","end":"2024-03-22T15:51:11.377Z","_duration":2,"uid":"8a8b4c6a-ad35-416b-9fd3-593d1cb9317c","cid":"0-0","title":"Then print result 5","fullTitle":"0: Then print result 5","output":[],"retries":0,"parent":"0","state":"passed"},{"type":"hook","start":"2024-03-22T15:51:11.377Z","end":"2024-03-22T15:51:11.377Z","_duration":0,"uid":"654d188c-3e50-4d42-b347-6375b31fd2cb","cid":"0-0","title":"","parent":"0","errors":[]}],"description":""}
  addBddScenario(scenario) {
    if (!this.client) return;

    const { title, _duration: duration, error, output } = scenario;

    const testId = parseTest(title);

    const screenshotEndpoint = '/session/:sessionId/screenshot';
    const screenshotsBuffers = output
      .filter(el => el.endpoint === screenshotEndpoint && el.result && el.result.value)
      .map(el => Buffer.from(el.result.value, 'base64'));

    return this.client.addTestRun(state, {
      error,
      title,
      test_id: testId,
      time: duration,
      filesBuffers: screenshotsBuffers,
    });
  }
}

module.exports = WebdriverReporter;
