const TestomatClient = require('../client');
const TRConstants = require('../constants');
const { parseTest, ansiRegExp } = require('../util');
const { PASSED } = require('../constants');

class JasmineReporter {
  constructor(options) {
    const { apiKey } = options;
    if (apiKey === undefined || apiKey === '') {
      throw new Error('Testomat API key cannot be empty');
    }
    this.testTimeMap = {};
    this.client = new TestomatClient({ apiKey });
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
    const title = result.description;
    const { status } = result;
    let errorMessage = '';

    for (let i = 0; i < result.failedExpectations.length; i += 1) {
      errorMessage = `${errorMessage}Failure: ${result.failedExpectations[i].message}\n`;
      errorMessage = `${errorMessage}\n ${result.failedExpectations[i].stack}`;
    }
    console.log(`${title} : ${PASSED}`);
    console.log(errorMessage);
    const testId = parseTest(title);
    errorMessage = errorMessage.replace(ansiRegExp(), '');
    this.client.addTestRun(testId, status, {
      error: result.failedExpectations[0],
      message: errorMessage,
      title,
      time: this.getDuration(result)
    });
  }
}

module.exports = JasmineReporter;
