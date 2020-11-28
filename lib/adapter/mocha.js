const mocha = require('mocha');
const TestomatClient = require('../client');
const TRConstants = require('../constants');
const { parseTest } = require('../util');

function MochaReporter(runner, opts) {
  mocha.reporters.Base.call(this, runner);
  let passes = 0;
  let failures = 0;

  const { apiKey } = opts.reporterOptions;
  if (apiKey === undefined || apiKey === '') {
    throw new Error('API key cannot be empty');
  }
  const client = new TestomatClient({ apiKey });

  runner.on('start', () => {
    client.createRun();
  });

  runner.on('pass', (test) => {
    passes += 1;
    console.log('pass: %s', test.fullTitle());
    const testId = parseTest(test.title);
    client.addTestRun(testId, TRConstants.PASSED, {
      title: test.title,
      time: test.duration
    });
  });

  runner.on('fail', (test, err) => {
    failures += 1;
    console.log('fail: %s -- error: %s', test.fullTitle(), err.message);
    const testId = parseTest(test.title);
    client.addTestRun(testId, TRConstants.FAILED, {
      error: err,
      title: test.title,
      time: test.duration
    });;
  });

  runner.on('end', () => {
    console.log('end: %d/%d', passes, passes + failures);
    const status = failures === 0 ? TRConstants.PASSED : TRConstants.FAILED;
    client.updateRunStatus(status);
  });
}

// To have this reporter "extend" a built-in reporter uncomment the following line:
mocha.utils.inherits(MochaReporter, mocha.reporters.Spec);


module.exports = MochaReporter;
