// eslint-disable-next-line global-require, import/no-extraneous-dependencies
const Mocha = require('mocha');
const chalk = require('chalk');
const TestomatClient = require('../client');
const { STATUS, TESTOMAT_TMP_STORAGE_DIR } = require('../constants');
const { parseTest, fileSystem } = require('../utils/utils');
const { logger } = require('../storages/logger');

const {
  EVENT_RUN_BEGIN,
  EVENT_RUN_END,
  EVENT_TEST_FAIL,
  EVENT_TEST_PASS,
  EVENT_TEST_PENDING,
  EVENT_SUITE_BEGIN,
  EVENT_SUITE_END,
  EVENT_TEST_BEGIN,
  EVENT_TEST_END,
} = Mocha.Runner.constants;

function MochaReporter(runner, opts) {
  Mocha.reporters.Base.call(this, runner);
  let passes = 0;
  let failures = 0;
  let skipped = 0;
  // let artifactStore;

  const apiKey = opts?.reporterOptions?.apiKey || process.env.TESTOMATIO;

  const client = new TestomatClient({ apiKey });

  runner.on(EVENT_RUN_BEGIN, () => {
    client.createRun();

    fileSystem.clearDir(TESTOMAT_TMP_STORAGE_DIR);
  });

  runner.on(EVENT_SUITE_BEGIN, async suite => {
    logger.setContext(suite.fullTitle());
  });

  runner.on(EVENT_SUITE_END, async () => {
    logger.setContext(null);
  });

  runner.on(EVENT_TEST_BEGIN, async test => {
    logger.setContext(test.fullTitle());
  });

  runner.on(EVENT_TEST_END, async () => {
    logger.setContext(null);
  });

  runner.on(EVENT_TEST_PASS, async test => {
    passes += 1;
    console.log(chalk.bold.green('✔'), test.fullTitle());
    const testId = parseTest(test.title);

    const logs = getTestLogs(test);

    client.addTestRun(STATUS.PASSED, {
      test_id: testId,
      title: test.title,
      time: test.duration,
      logs,
    });
  });

  runner.on(EVENT_TEST_PENDING, test => {
    skipped += 1;
    console.log('skip: %s', test.fullTitle());
    const testId = parseTest(test.title);
    client.addTestRun(STATUS.SKIPPED, {
      title: test.title,
      test_id: testId,
      time: test.duration,
    });
  });

  runner.on(EVENT_TEST_FAIL, async (test, err) => {
    failures += 1;
    console.log(chalk.bold.red('✖'), test.fullTitle(), chalk.gray(err.message));
    const testId = parseTest(test.title);

    const logs = getTestLogs(test);

    client.addTestRun(STATUS.FAILED, {
      error: err,
      test_id: testId,
      title: test.title,
      time: test.duration,
      logs,
    });
  });

  runner.on(EVENT_RUN_END, () => {
    const status = failures === 0 ? STATUS.PASSED : STATUS.FAILED;
    console.log(chalk.bold(status), `${passes} passed, ${failures} failed, ${skipped} skipped`);
    client.updateRunStatus(status);
  });
}

function getTestLogs(test) {
  const suiteLogsArr = logger.getLogs(test.parent.fullTitle());
  const suiteLogs = suiteLogsArr ? suiteLogsArr.join('\n').trim() : '';
  const testLogsArr = logger.getLogs(test.fullTitle());
  const testLogs = testLogsArr ? testLogsArr.join('\n').trim() : '';

  let logs = '';
  if (suiteLogs) {
    logs += `${chalk.bold('\t--- BeforeSuite ---')}\n${suiteLogs}`;
  }
  if (testLogs) {
    logs += `\n${chalk.bold('\t--- Test ---')}\n${testLogs}`;
  }
  return logs;
}

// To have this reporter "extend" a built-in reporter uncomment the following line:
Mocha.utils.inherits(MochaReporter, Mocha.reporters.Spec);

module.exports = MochaReporter;
