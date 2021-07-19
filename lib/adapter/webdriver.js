const WDIOReporter = require("@wdio/reporter").default;
const TestomatClient = require("../client");
const TRConstants = require("../constants");
const { parseTest, ansiRegExp } = require("../util");

class WebdriverReporter extends WDIOReporter {
  constructor(options) {
    super(options);

    const { apiKey } = options;
    if (!apiKey) return;

    this.client = new TestomatClient({ apiKey });
    options = Object.assign(options, { stdout: true });
  }

  onTestEnd(test) {
    this.addTest(test);
  }

  addTest(test) {
    if (!this.client) return;

    const { title, _duration: duration, state, error } = test;

    const testId = parseTest(title);

    this.client.addTestRun(testId, state, {
      error,
      title,
      time: duration,
    });
  }
}

module.exports = WebdriverReporter;
