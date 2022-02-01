const TRConstants = require('../../constants');
const { parseTest } = require('../../util');
const TestomatClient = require('../../client');

const testomatioReporter = on => {
  const client = new TestomatClient({ apiKey: process.env.TESTOMATIO });

  on('before:run', async () => {
    await client.createRun();
  });

  on('after:spec', async (_spec, results) => {
    const addSpecTestsPromises = [];

    for (const test of results.tests) {
      const latestAttempt = test.attempts[test.attempts.length - 1];
      console.log({ latestAttempt })
      const time = latestAttempt.duration;
      const error = latestAttempt.error;

      const title = test.title[1]; // [0] - spec title, [1] - test title
      const testId = parseTest(title);

      const videos = [results.video];
      const screenshots = results.screenshots.map(screenshot => screenshot.path);
      const files = [...videos, ...screenshots];

      const state = test.state === 'passed' ? TRConstants.PASSED : TRConstants.FAILED;

      addSpecTestsPromises.push(client.addTestRun(testId, state, { title, time, error, files }));
    }

    await Promise.all(addSpecTestsPromises);
  });

  on('after:run', async results => {
    const status = results.totalFailed ? TRConstants.FAILED : TRConstants.PASSED;
    await client.updateRunStatus(status);
  });
};

module.exports = testomatioReporter;
