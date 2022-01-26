const TRConstants = require('../../constants');
const { parseTest } = require('../../util');
const TestomatClient = require('../../client');

const testomatioReporter = on => {
  const testomatio = new TestomatClient({ apiKey: process.env.TESTOMATIO });

  on('before:run', async () => {
    await testomatio.createRun();
  });

  on('after:run', async results => {
    const promises = [];

    for (const run of results.runs) {
      for (const test of run.tests) {
        const latestAttempt = test.attempts[test.attempts.length - 1];
        const time = latestAttempt.duration;
        const error = latestAttempt.error;

        const title = test.title[1]; // [0] - spec title, [1] - test title
        const testId = parseTest(title);

        const videos = [run.video];
        const screenshots = latestAttempt.screenshots.map(screenshot => screenshot.path);
        const files = [...videos, ...screenshots];

        const state = test.state === 'passed' ? TRConstants.PASSED : TRConstants.FAILED;

        promises.push(testomatio.addTestRun(testId, state, { title, time, error, files }));
      }
    }

    // Add tests
    await Promise.all(promises);

    // Update run status
    const status = results.totalFailed ? TRConstants.FAILED : TRConstants.PASSED;
    await testomatio.updateRunStatus(status);
  });
};

module.exports = testomatioReporter;
