// eslint-disable-next-line global-require, import/no-extraneous-dependencies
const WDIOReporter = require('@wdio/reporter').default;
const TestomatClient = require('../client');
const { parseTest } = require('../util');

class WebdriverReporter extends WDIOReporter {
  constructor(options) {
    super(options);

    const { apiKey } = options;
    if (!apiKey) return;

    this.client = new TestomatClient({ apiKey });
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

  async addTest(test) {
    if (!this.client) return;

    const { title, _duration: duration, state, error, output } = test;

    const testId = parseTest(title);

    const screenshotEndpoint = '/session/:sessionId/screenshot';
    const screenshotsBuffers = output
      .filter(el => el.endpoint === screenshotEndpoint && el.result && el.result.value)
      .map(el => Buffer.from(el.result.value, 'base64'));

    await this.client.addTestRun(testId, state, {
      error,
      title,
      time: duration,
      filesBuffers: screenshotsBuffers,
    });
  }
}

module.exports = WebdriverReporter;
