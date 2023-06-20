const TestomatClient = require('../client');
const { STATUS, TESTOMAT_TMP_STORAGE } = require('../constants');
const { parseTest, ansiRegExp, fileSystem } = require('../util');

class JestReporter {
  constructor(globalConfig, options) {
    this._globalConfig = globalConfig;
    this._options = options;

    this.client = new TestomatClient({ apiKey: options?.apiKey });
    this.client.createRun();
  }

  static getIdOfCurrentlyRunningTest() {
    // @ts-expect-error "expect" could only be defined inside Jest environement (forbidden to import it outside)
    return parseTest(expect?.getState()?.currentTestName) || null; // eslint-disable-line
  }

  onRunStart() {
    // clear tmp dir
    fileSystem.clearDir(TESTOMAT_TMP_STORAGE.mainDir);
  }

  onTestResult(test, testResult) {
    if (!this.client) return;

    const { testResults } = testResult;
    for (const result of testResults) {
      let error;
      let steps;
      const { status, title, duration, failureMessages } = result;
      if (failureMessages[0]) {
        let errorMessage = failureMessages[0].replace(ansiRegExp(), '');
        errorMessage = errorMessage.split('\n')[0];
        error = new Error(errorMessage);
        steps = failureMessages[0];
      }
      const testId = parseTest(title);
      const deducedStatus = status === 'pending' ? 'skipped' : status;
      // In jest if test is not matched with test name pattern it is considered as skipped.
      // So adding a check if it is skipped for real or because of test pattern
      if (!this._globalConfig.testNamePattern || deducedStatus !== 'skipped') {
        this.client.addTestRun(deducedStatus, {
          test_id: testId,
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
    const status = numFailedTests === 0 ? STATUS.PASSED : STATUS.FAILED;
    this.client.updateRunStatus(status);

    // clear tmp dir
    fileSystem.clearDir(TESTOMAT_TMP_STORAGE.mainDir);
  }
}

module.exports = JestReporter;
