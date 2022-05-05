const TRConstants = require('../../constants');
const { parseTest, parseSuite } = require('../../util');
const TestomatClient = require('../../client');

const testomatioReporter = on => {
  const client = new TestomatClient({ apiKey: process.env.TESTOMATIO });

  on('before:run', async (run) => {
    if (!client.env) {
      client.env = `${run.browser.displayName},${run.system.osName}`
    }
    await client.createRun();
  });

  on('after:spec', async (_spec, results) => {
    const addSpecTestsPromises = [];

    const videos = [results.video];

    for (const test of results.tests) {
      const lastAttemptIndex = test.attempts.length - 1;
      const latestAttempt = test.attempts[lastAttemptIndex];

      const time = latestAttempt.duration;
      const error = latestAttempt.error;

      const title = test.title.pop();
      const suiteTitle = test.title.pop();

      const testId = parseTest(title);
      const suiteId = parseSuite(suiteTitle);

      if (error) {
        error.inspect = function() {
          return this.codeFrame.frame;
        }
      }

      const screenshots = results.screenshots
        .filter(screenshot => screenshot.path.includes(title))
        .filter(screenshot => screenshot.testAttemptIndex === lastAttemptIndex)
        .map(screenshot => screenshot.path);

      const files = [...videos, ...screenshots];

      const state = test.state === 'passed' ? TRConstants.PASSED : TRConstants.FAILED;

      addSpecTestsPromises.push(client.addTestRun(testId, state, {
        title, time, error, files, suite_title: suiteTitle, suite_id: suiteId
      }));
    }

    await Promise.all(addSpecTestsPromises);
  });

  on('after:run', async results => {
    const status = results.totalFailed ? TRConstants.FAILED : TRConstants.PASSED;
    await client.updateRunStatus(status);
  });
};

module.exports = testomatioReporter;
