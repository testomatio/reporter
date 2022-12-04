// eslint-disable-next-line global-require, import/no-extraneous-dependencies
const Mocha = require('mocha');
const chalk = require('chalk');
const TestomatClient = require('../client');
const TRConstants = require('../constants');
const { parseTest } = require('../util');

const { EVENT_RUN_BEGIN, EVENT_RUN_END, EVENT_TEST_FAIL, EVENT_TEST_PASS } = Mocha.Runner.constants;

function MochaReporter(runner, opts) {
  Mocha.reporters.Base.call(this, runner);
  let passes = 0;
  let failures = 0;

  const client = new TestomatClient({ apiKey: opts?.reporterOptions?.apiKey });

  runner.on(EVENT_RUN_BEGIN, () => {
    client.createRun();
  });

  runner.on(EVENT_TEST_PASS, test => {
    passes += 1;
    console.log(chalk.bold.green('✔'), test.fullTitle());
    const testId = parseTest(test.title);
    client.addTestRun(testId, TRConstants.PASSED, {
      title: test.title,
      time: test.duration,
    });
  });

  runner.on(EVENT_TEST_FAIL, (test, err) => {
    failures += 1;
    console.log(chalk.bold.red('✖'), test.fullTitle(), chalk.gray(err.message));
    const testId = parseTest(test.title);
    client.addTestRun(testId, TRConstants.FAILED, {
      error: err,
      title: test.title,
      time: test.duration,
    });
  });

  runner.on(EVENT_RUN_END, () => {
    const status = failures === 0 ? TRConstants.PASSED : TRConstants.FAILED;
    console.log(chalk.bold(status), `${passes} passed, ${failures} failed`);
    client.updateRunStatus(status);
  });
}

// To have this reporter "extend" a built-in reporter uncomment the following line:
Mocha.utils.inherits(MochaReporter, Mocha.reporters.Spec);

module.exports = MochaReporter;
