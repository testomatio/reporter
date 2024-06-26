const { TestomatioClient } = require('../client');
const mod = require('./file.js');

class TestomatioReporter {
  constructor(config = {}) {
    this.client = new TestomatioClient({ apiKey: config?.apiKey });
    console.log('!!!!!', mod);
  }

  // on run start
  onInit(ctx) {
    console.log('init');
  }

  // paths array to files with tests
  onPathsCollected(paths) {
    console.log('paths collected');
  }

  // files array with tests
  onCollected(files) {
    // file.filepath
    // file.name : test/basics.test.ts
    // file.tasks - array of tests
    console.log('collected');
  }

  /**
   * @typeof {import('../vitest-types').TestFile} TestFile
   * @param {import('../../types').TestFile[]} files
   * @param {*} errors
   */
  onFinished(files, errors) {
    // files  - array with results;
    // errors does not contain errors from tests; probably its testrunner errors

    // function processPlaywrightSuites(suites: Suite[]) {
    //   for (const suite of suites) {
    //     const mostInnerSuiteTitle = suite.title;

    //     suitesCount += 1;
    //     // amountOfSpecs += suite.specs.length;
    //     for (const spec of suite.specs) {
    //       testsCount += spec.tests.length;
    //     }

    //     createExecutionsWithIssueKeys(suite.specs, mostInnerSuiteTitle);
    //     if (suite.suites) {
    //       processPlaywrightSuites(suite.suites);
    //     }
    //   }
    // }

    // 
    files.forEach(file => {
      file.tasks.forEach(task => {
        if (task.type === 'test') {
          console.log('test:', task.name);
        } else if (task.type === 'suite') {
          console.error(`Unprocessed case. Test ${task.name} is not present in file.tasks array`);
        } else {
          throw new Error('Unprocessed case. Unknown task type');
        }
      });
    });

    console.log('finished');
    if (errors.length) console.error('Vitest adapter errors:', errors);
  }

  // smth strange
  // onTaskUpdate(packs) {
  //   console.log('task update')
  // }

  onTestRemoved(trigger) {
    console.log('test removed');
  }

  onWatcherStart(files, errors) {
    console.log('watcher start');
  }

  onWatcherRerun(files, trigger) {
    console.log('watcher rerun');
  }

  onServerRestart(reason) {
    console.log('server restart');
  }

  // gathers console logs
  onUserConsoleLog(log) {
    // console.log('user console log')
  }

  onProcessTimeout() {
    console.log('process timeout');
  }
}

module.exports = TestomatioReporter;
module.exports.default = TestomatioReporter;
