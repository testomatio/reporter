// eslint-disable-next-line global-require, import/no-extraneous-dependencies
const Mocha = require('mocha');
const chalk = require('chalk');
const TestomatClient = require('../client');
const TRConstants = require('../constants');
const { parseTest } = require('../util');
const ArtifactStorage = require('../ArtifactStorage');

const { EVENT_RUN_BEGIN, EVENT_RUN_END, EVENT_TEST_FAIL, EVENT_TEST_PASS, EVENT_TEST_PENDING } = Mocha.Runner.constants;

function MochaReporter(runner, opts) {
  Mocha.reporters.Base.call(this, runner);
  let passes = 0; let failures = 0; let skipped = 0; // eslint-disable-line no-unused-vars //TODO: fix - show skip number
  let artifactStore;

  const apiKey = opts?.reporterOptions?.apiKey || process.env.TESTOMATIO;

  if (!apiKey) {
    console.log('TESTOMATIO key is empty, ignoring reports');
    return;
  }
  const client = new TestomatClient({ apiKey });

  runner.on(EVENT_RUN_BEGIN, () => {
    client.createRun();

    (runner._workerReporter != undefined)
      ? artifactStore = new ArtifactStorage(true)
      : artifactStore = new ArtifactStorage();
  });

  runner.on(EVENT_TEST_PASS, async(test) => {
    passes += 1;
    console.log(chalk.bold.green('✔'), test.fullTitle());
    const testId = parseTest(test.title);
    //TODO: прокинуть в сами тесты, а сейчас обработка идет в методе => addTestRun()
    //нужно наверное добавить параметр для addTestRun(artifcats) и сюда прокидывать артифакты или из глобал, или из тмпДир
    const contents = await artifactStore.tmpContents(); //TODO: норм ли это для производительности???

    console.log("CONTENTS", contents);
    
    client.addTestRun(
      testId, 
      TRConstants.PASSED, 
      {
        title: test.title,
        time: test.duration,
      },
      contents
    );
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

    artifactStore.cleanup();
  });
}

// To have this reporter "extend" a built-in reporter uncomment the following line:
Mocha.utils.inherits(MochaReporter, Mocha.reporters.Spec);

module.exports = MochaReporter;
