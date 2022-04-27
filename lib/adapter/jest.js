const TestomatClient = require('../client');
const TRConstants = require('../constants');
const { parseTest, ansiRegExp } = require('../util');

class JestReporter {
  constructor(globalConfig, options) {
    this._globalConfig = globalConfig;
    this._options = options;
    const { apiKey } = options;

    if (!apiKey) {
      console.log('TESTOMATIO key is empty, ignoring reports');
      return;
    }

    this.client = new TestomatClient({ apiKey });
    this.client.createRun();
  }

  onTestResult(test, testResult) {
    if (!this.client) return;

    const { testResults } = testResult;
    for (const result of testResults) {
      let error = null;
      let steps = null;
      const { status, title, duration, failureMessages } = result;
      if (failureMessages[0]) {
        let errorMessage = failureMessages[0].replace(ansiRegExp(), '');
        errorMessage = errorMessage.split('\n')[0];
        error = {
          message: errorMessage,
        };
        steps = failureMessages[0];
      }
      const testId = parseTest(title);
      const deducedStatus = status === 'pending' ? 'skipped' : status;

      const suite_title = result.ancestorTitles && result.ancestorTitles[result.ancestorTitles.length - 1];
      // In jest if test is not matched with test name pattern it is considered as skipped.
      // So adding a check if it is skipped for real or because of test pattern
      if (!this._globalConfig.testNamePattern || deducedStatus !== 'skipped') {
        this.client.addTestRun(testId, deducedStatus, {
          suite_title,
          error,
          steps,
          title,
          time: duration,
        });
      }
    }
  }

  onRunComplete(contexts, results) {
    if (!this.client) return;

    const { numFailedTests } = results;
    const status = numFailedTests === 0 ? TRConstants.PASSED : TRConstants.FAILED;
    this.client.updateRunStatus(status);
  }
}

module.exports = JestReporter;
