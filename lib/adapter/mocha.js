// eslint-disable-next-line global-require, import/no-extraneous-dependencies
const Mocha = require('mocha');
const TestomatClient = require('../client');
const TRConstants = require('../constants');
const { parseTest } = require('../util');

const { EVENT_RUN_BEGIN, EVENT_RUN_END, EVENT_TEST_FAIL, EVENT_TEST_PASS, EVENT_TEST_PENDING } = Mocha.Runner.constants;

function MochaReporter(runner, opts) {
  Mocha.reporters.Base.call(this, runner);
  let passes = 0; let failures = 0; let skipped = 0; // eslint-disable-line no-unused-vars

  const apiKey = opts?.reporterOptions?.apiKey || process.env.TESTOMATIO;

  if (!apiKey) {
    console.log('TESTOMATIO key is empty, ignoring reports');
    return;
  }
  const client = new TestomatClient({ apiKey });

  runner.on(EVENT_RUN_BEGIN, () => {
    client.createRun();
  });

  runner.on(EVENT_TEST_PASS, test => {
    passes += 1;
    console.log('pass: %s', test.fullTitle());
    const testId = parseTest(test.title);
    client.addTestRun(testId, TRConstants.PASSED, {
      title: test.title,
      time: test.duration,
    });
  });

  runner.on(EVENT_TEST_PENDING, test => {
    skipped += 1;
    console.log('skip: %s', test.fullTitle());
    const testId = parseTest(test.title);
    client.addTestRun(testId, TRConstants.SKIPPED, {
      title: test.title,
      time: test.duration,
    });
  });

  runner.on(EVENT_TEST_FAIL, (test, err) => {
    failures += 1;
    console.log('fail: %s -- error: %s', test.fullTitle(), err.message);
    const testId = parseTest(test.title);
    client.addTestRun(testId, TRConstants.FAILED, {
      error: err,
      title: test.title,
      time: test.duration,
    });
  });

  runner.on(EVENT_RUN_END, () => {
    console.log('end: %d/%d', passes, passes + failures);
    const status = failures === 0 ? TRConstants.PASSED : TRConstants.FAILED;
    client.updateRunStatus(status);
  });
}

// To have this reporter "extend" a built-in reporter uncomment the following line:
Mocha.utils.inherits(MochaReporter, Mocha.reporters.Spec);

module.exports = MochaReporter;
