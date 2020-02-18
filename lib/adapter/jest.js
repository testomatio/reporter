const TestomatClient = require('../client');
const TRConstants = require('../constants');
const { parseTest } = require('../util');

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
      const { status, title } = result;
      const testId = parseTest(title);
      if (testId) {
        this.client.addTestRun(testId, status);
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
