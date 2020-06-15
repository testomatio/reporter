const WDIOReporter = require('@wdio/reporter').default;
const TestomatClient = require('../client');
const TRConstants = require('../constants');
const { parseTest, ansiRegExp } = require('../util');


class WebdriverReporter extends WDIOReporter {
  constructor(options) {
    super(options);

    const { apiKey } = options;
    this.client = new TestomatClient({ apiKey });
    options = Object.assign(options, { stdout: true });
  }

  onTestEnd(test) {
    this.addTest(test);
  }

  addTest(test) {
    const {
      title, _duration: duration, state, error,
    } = test;

    const testId = parseTest(title);
    const errorMsg = error ? error.stack : undefined;

    this.client.addTestRun(testId, state, errorMsg || '', title, duration);
  }
}

module.exports = WebdriverReporter;
