// eslint-disable-next-line global-require, import/no-extraneous-dependencies
const Mocha = require('mocha');
const chalk = require('chalk');
const TestomatClient = require('../client');
const { STATUS, TESTOMAT_TMP_STORAGE_DIR } = require('../constants');
const { parseTest, fileSystem } = require('../utils/utils');

const { EVENT_RUN_BEGIN, EVENT_RUN_END, EVENT_TEST_FAIL, EVENT_TEST_PASS, EVENT_TEST_PENDING } =
  Mocha.Runner.constants;

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

  runner.on(EVENT_TEST_PASS, async test => {
    passes += 1;
    
    console.log(chalk.bold.green('✔'), test.fullTitle());
    const testId = parseTest(test.title);

    client.addTestRun(STATUS.PASSED, {
      test_id: testId,
      suite_title: getSuiteTitle(test),
      title: getTestName(test),
      code: test.body.toString(),
      file: getFile(test),
      time: test.duration,
    });
  });

  runner.on(EVENT_TEST_PENDING, test => {
    skipped += 1;
    console.log('skip: %s', test.fullTitle());
    const testId = parseTest(test.title);
    client.addTestRun(STATUS.SKIPPED, {
      title: getTestName(test),
      suite_title: getSuiteTitle(test),
      code: test.body.toString(),
      file: getFile(test),
      test_id: testId,
      time: test.duration,
    });
  });

  runner.on(EVENT_TEST_FAIL, async (test, err) => {
    failures += 1;
    console.log(chalk.bold.red('✖'), test.fullTitle(), chalk.gray(err.message));
    const testId = parseTest(test.title);

    client.addTestRun(STATUS.FAILED, {
      error: err,
      suite_title: getSuiteTitle(test),
      file: getFile(test),
      test_id: testId,
      title: getTestName(test),
      code: test.body.toString(),
      time: test.duration,
    });
  });

  runner.on(EVENT_RUN_END, () => {
    const status = failures === 0 ? STATUS.PASSED : STATUS.FAILED;
    console.log(chalk.bold(status), `${passes} passed, ${failures} failed, ${skipped} skipped`);
    client.updateRunStatus(status);
  });
}

// To have this reporter "extend" a built-in reporter uncomment the following line:
Mocha.utils.inherits(MochaReporter, Mocha.reporters.Spec);

module.exports = MochaReporter;

function getSuiteTitle(test, pathArr = []) {
  pathArr.push(test.parent.title);
  if (test.parent.parent) getSuiteTitle(test.parent, pathArr);
  return pathArr.reverse().filter(t => !!t).join(' / ');
}

function getFile(test) {
  return test.parent.file?.replace(process.cwd(), '');
}

function getTestName(test) {
  return test.fullTitle();
}