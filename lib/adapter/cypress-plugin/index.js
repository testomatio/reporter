const { STATUS } = require('../../constants');
const { getTestomatIdFromTestTitle, parseSuite } = require('../../utils/utils');
const TestomatClient = require('../../client');
const config = require('../../config');

const testomatioReporter = on => {
  if (!config.TESTOMATIO) {
    console.log('TESTOMATIO key is empty, ignoring reports');
    return;
  }
  const client = new TestomatClient({ apiKey: config.TESTOMATIO });

  on('before:run', async run => {
    // TODO: looks like client.env does not exist
    if (!client.env) {
      client.env = `${run.browser.displayName},${run.system.osName}`;
    }
    await client.createRun();
  });

  on('after:spec', async (_spec, results) => {
    const addSpecTestsPromises = [];

    const videos = [results.video];

    for (const test of results.tests) {
      const lastAttemptIndex = test.attempts.length - 1;
      const latestAttempt = test.attempts[lastAttemptIndex];

      // latestAttempt.duration && latestAttempt.error were available in adapters version up to 13 JFYI
      const time = latestAttempt.duration || latestAttempt.wallClockDuration || test.duration;
      let error = latestAttempt.error;

      let title = test.title.pop();
      const examples = title.match(/\(example (#\d+)\)/);
      let example = null;
      if (examples && examples[1]) example = { example: examples[1] };
      title = title.replace(/\(example #\d+\)/, '').trim();

      const suiteTitle = test.title.pop();

      const testId = getTestomatIdFromTestTitle(title);
      const suiteId = parseSuite(suiteTitle);

      if (!error && test.displayError) {
        error = { message: test.displayError };
        error.inspect = function () {
          // eslint-disable-line func-names
          return this.message;
        };
      }

      const formattedError = error
        ? {
            message: error.message,
            inspect:
              error.inspect ||
              function () {
                return this.message;
              },
          }
        : '';

      const screenshots = Array.isArray(results.screenshots)
        ? results.screenshots
            .filter(screenshot => screenshot?.path && screenshot?.path.includes(title) && screenshot?.takenAt)
            .map(screenshot => screenshot.path)
        : [];

      const files = [...videos, ...screenshots];

      let state;
      switch (test.state) {
        case 'passed':
          state = STATUS.PASSED;
          break;
        case 'failed':
          state = STATUS.FAILED;
          break;
        case 'skipped':
        case 'pending':
        default:
          state = STATUS.SKIPPED;
      }

      addSpecTestsPromises.push(
        client.addTestRun(state, {
          title,
          time,
          example,
          error: formattedError,
          files,
          suite_title: suiteTitle,
          test_id: testId,
          suite_id: suiteId,
        }),
      );
    }

    await Promise.all(addSpecTestsPromises);
  });

  on('after:run', async results => {
    const status = results.totalFailed ? STATUS.FAILED : STATUS.PASSED;
    await client.updateRunStatus(status);
  });
};

module.exports = testomatioReporter;
