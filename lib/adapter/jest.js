const TestomatClient = require('../client');
const TRConstants = require('../constants');
const { parseTest, ansiRegExp } = require('../util');

class JestReporter {
  constructor(globalConfig, options) {
    this._globalConfig = globalConfig;
    this._options = options;
    const { apiKey } = options;
    if (apiKey === undefined || apiKey === '') {
      throw new Error('Testomat API key cannot be empty');
    }

    this.client = new TestomatClient({ apiKey });
    this.client.createRun();
  }

  onTestResult(test, testResult) {
    const { testResults } = testResult;
    for (const result of testResults) {
      let error = '';
      const {
        status, title, duration, failureMessages,
      } = result;
      if (failureMessages[0]) {
        error = failureMessages[0].replace(ansiRegExp(), '');
      }
      const testId = parseTest(title);
      const deducedStatus = status === 'pending' ? 'skipped' : status;

      // In jest if test is not matched with test name pattern it is considered as skipped.
      // So adding a check if it is skipped for real or because of test pattern
      if (!this._globalConfig.testNamePattern || deducedStatus !== 'skipped') {
        this.client.addTestRun(testId, deducedStatus, {
          error, title, time: duration
        });
      }
    }
  }

  onRunComplete(contexts, results) {
    const { numFailedTests } = results;
    const status = numFailedTests === 0 ? TRConstants.PASSED : TRConstants.FAILED;
    this.client.updateRunStatus(status);
  }
}

module.exports = JestReporter;
