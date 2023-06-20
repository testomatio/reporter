// eslint-disable-next-line global-require, import/no-extraneous-dependencies
const Mocha = require('mocha');
const debug = require('debug')('@testomatio/reporter:adapter:mocha');
const chalk = require('chalk');
const TestomatClient = require('../client');
const { STATUS } = require('../constants');
const { parseTest, specificTestInfo } = require('../util');
const ArtifactStorage = require('../_ArtifactStorageOld');

const { EVENT_RUN_BEGIN, EVENT_RUN_END, EVENT_TEST_FAIL, EVENT_TEST_PASS, EVENT_TEST_PENDING } = Mocha.Runner.constants;

function MochaReporter(runner, opts) {
  Mocha.reporters.Base.call(this, runner);
  let passes = 0; let failures = 0; let skipped = 0;
  let artifactStore;

  const apiKey = opts?.reporterOptions?.apiKey || process.env.TESTOMATIO;

  if (!apiKey) {
    debug('TESTOMATIO key is empty, ignoring reports');
    return;
  }
  const client = new TestomatClient({ apiKey });

  runner.on(EVENT_RUN_BEGIN, () => {
    client.createRun();

    const params = { 
      toFile: true
    };
    
    artifactStore = runner._workerReporter !== undefined
      ? new ArtifactStorage(params)
      : new ArtifactStorage();
  });

  runner.on(EVENT_TEST_PASS, async(test) => {
    passes += 1;
    console.log(chalk.bold.green('✔'), test.fullTitle());
    const testId = parseTest(test.title);

    const specificTest =  specificTestInfo(test);
    const content = await artifactStore.artifactByTestName(specificTest);

    debug(`test=${specificTest} content = `, content);

    client.addTestRun(
      STATUS.PASSED, 
      {
        test_id: testId,
        title: test.title,
        time: test.duration,
      },
      content
    );
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

  runner.on(EVENT_TEST_FAIL, async(test, err) => {
    failures += 1;
    console.log(chalk.bold.red('✖'), test.fullTitle(), chalk.gray(err.message));
    const testId = parseTest(test.title);

    const specificTest =  specificTestInfo(test);
    const content = await artifactStore.artifactByTestName(specificTest);

    debug(`fail test=${specificTest} content = `, content);

    client.addTestRun(
      STATUS.FAILED, {
        error: err,
        test_id: testId,
        title: test.title,
        time: test.duration,
      }, 
      content
    );
  });

  runner.on(EVENT_RUN_END, () => {
    const status = failures === 0 ? STATUS.PASSED : STATUS.FAILED;
    console.log(chalk.bold(status), `${passes} passed, ${failures} failed, ${skipped} skipped`);
    client.updateRunStatus(status);

    artifactStore.cleanup();
  });
}

// To have this reporter "extend" a built-in reporter uncomment the following line:
Mocha.utils.inherits(MochaReporter, Mocha.reporters.Spec);

module.exports = MochaReporter;
