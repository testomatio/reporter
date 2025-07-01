const TestomatClient = require('../client');
const { getTestomatIdFromTestTitle, ansiRegExp } = require('../utils/utils');
const { STATUS } = require('../constants');

class JasmineReporter {
  constructor(options) {
    this.testTimeMap = {};
    this.client = new TestomatClient({ apiKey: options?.apiKey });
    this.client.createRun();
  }

  getDuration(test) {
    if (this.testTimeMap[test.id]) {
      return Date.now() - this.testTimeMap[test.id];
    }

    return 0;
  }

  specStarted(result) {
    this.testTimeMap[result.id] = Date.now();
  }

  specDone(result) {
    if (!this.client) return;

    const title = result.description;
    const { status } = result;
    let errorMessage = '';

    for (let i = 0; i < result.failedExpectations.length; i += 1) {
      errorMessage = `${errorMessage}Failure: ${result.failedExpectations[i].message}\n`;
      errorMessage = `${errorMessage}\n ${result.failedExpectations[i].stack}`;
    }
    console.log(`${title} : ${STATUS.PASSED}`);
    console.log(errorMessage);
    const testId = getTestomatIdFromTestTitle(title);
    errorMessage = errorMessage.replace(ansiRegExp(), '');
    this.client.addTestRun(status, {
      error: result.failedExpectations[0],
      message: errorMessage,
      test_id: testId,
      title,
      time: this.getDuration(result),
    });
  }

  jasmineDone(suiteInfo, done) {
    if (!this.client) return;

    const { overallStatus } = suiteInfo;
    const status = overallStatus === 'failed' ? STATUS.FAILED : STATUS.PASSED;

    this.client.updateRunStatus(status).then(() => done);
  }
}

module.exports = JasmineReporter;
