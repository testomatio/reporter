const chalk = require('chalk');
const TestomatClient = require('../client');
const { STATUS, TESTOMAT_TMP_STORAGE_DIR } = require('../constants');
const { getTestomatIdFromTestTitle, ansiRegExp, fileSystem } = require('../utils/utils');
const { services } = require('../services');
const debug = require('debug')('@testomatio/reporter:adapter-jest');
const path = require('path');

class JestReporter {
  constructor(globalConfig, options) {
    this._globalConfig = globalConfig;
    this._options = options;

    this.client = new TestomatClient({ apiKey: options?.apiKey });
    this.client.createRun();
  }

  onRunStart() {
    // clear tmp dir
    fileSystem.clearDir(TESTOMAT_TMP_STORAGE_DIR);
  }

  // start of test file (including beforeAll)
  onTestStart(testFile) {
    debug('Start running test file:', testFile.path);
    services.setContext(testFile.path);
  }

  // start of the test (including beforeEach)
  onTestCaseStart(test, testCase) {
    debug('Start running test:', testCase.fullName);
    services.setContext(testCase.fullName);
  }

  // end of test file! (there is also onTestCaseResult listener)
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
      const testId = getTestomatIdFromTestTitle(title);

      // suite titles from most outer to most inner, separated by space
      let fullSuiteTitle = testResult.ancestorTitles?.join(' ');
      // if no suite titles, use file name
      if (!fullSuiteTitle && testResult.testFilePath) fullSuiteTitle = path.basename(testResult.testFilePath);

      const logs = getTestLogs(result);
      const artifacts = services.artifacts.get(result.fullName);
      const keyValues = services.keyValues.get(result.fullName);

      const deducedStatus = status === 'pending' ? 'skipped' : status;
      // In jest if test is not matched with test name pattern it is considered as skipped.
      // So adding a check if it is skipped for real or because of test pattern
      if (!this._globalConfig.testNamePattern || deducedStatus !== 'skipped') {
        this.client.addTestRun(deducedStatus, {
          test_id: testId,
          suite_title: fullSuiteTitle,
          error,
          steps,
          title,
          time: duration,
          logs,
          manuallyAttachedArtifacts: artifacts,
          meta: keyValues,
        });
      }
    }
  }

  onRunComplete(contexts, results) {
    if (!this.client) return;

    const { numFailedTests } = results;
    const status = numFailedTests === 0 ? STATUS.PASSED : STATUS.FAILED;
    this.client.updateRunStatus(status);
  }
}

function getTestLogs(testResult) {
  const suiteLogsArr = services.logger.getLogs(testResult.testFilePath);
  const suiteLogs = suiteLogsArr ? suiteLogsArr.join('\n').trim() : '';
  const testLogsArr = services.logger.getLogs(testResult.fullName);
  const testLogs = testLogsArr ? testLogsArr.join('\n').trim() : '';

  let logs = '';
  if (suiteLogs) {
    logs += `${chalk.bold('\t--- Suite ---')}\n${suiteLogs}`;
  }
  if (testLogs) {
    logs += `\n${chalk.bold('\t--- Test ---')}\n${testLogs}`;
  }
  return logs;
}

module.exports = JestReporter;
