const TestomatClient = require('@testomatio/reporter/lib/client.js');
const TRConstants = require('@testomatio/reporter/lib/constants.js');

// TODO: no such file, path have to be updated
const util = require('@testomatio/reporter/lib/util');

module.exports = () => {
  const apiKey = process.env.TESTOMATIO;
  let failed = false;

  if (apiKey === '' || apiKey === undefined) {
    throw new Error('Testomat.io API key cannot be empty');
  }
  const client = new TestomatClient({ apiKey });

  return {
    reportTaskStart(startTime, userAgents) {
      console.log('TestCafe started with: ', userAgents);
      client.createRun();
    },

    reportFixtureStart(name) {
      console.log(`Suite : ${name}`);
    },

    reportTestDone(name, testRunInfo) {
      let status = TRConstants.PASSED;
      let message = '';

      if (testRunInfo.skipped) {
        status = TRConstants.SKIPPED;
      }
      if (testRunInfo.errs.length) {
        status = TRConstants.FAILED;
        message = this.renderErrors(testRunInfo.errs);
        failed = true;
      }
      console.log(` - ${name} : ${status}`);
      const getTestomatIdFromTestTitle = util.getTestomatIdFromTestTitle || util.parseTest;
      client.addTestRun(getTestomatIdFromTestTitle(name), status, {
        error: testRunInfo.errs.length ? testRunInfo.errs[0] : null,
        message,
        title: name,
        time: testRunInfo.durationMs,
      });
    },

    renderErrors(errors) {
      let errorMessage = '';
      errors.forEach((error, id) => {
        errorMessage = `${errorMessage}${this.formatError(error, `${id + 1} `)}\n`;
      });

      console.log(errorMessage);
      return errorMessage.replace(util.ansiRegExp(), '');
    },

    reportTaskDone() {
      const status = failed ? TRConstants.FAILED : TRConstants.PASSED;
      console.log(`Status : ${status}`);
      client.updateRunStatus(status);
    },
  };
};
