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
   * @param {import('../../types').VitestTestFile[]} files
   * @param {*} errors
   */
  onFinished(files, errors) {
    // files  - array with results;
    // errors does not contain errors from tests; probably its testrunner errors

    files.forEach(file => {
      // task could be test or suite
      file.tasks.forEach(taskOrSuite => {
        if (taskOrSuite.type === 'test') {
          console.log('test:', taskOrSuite.name);
          // process task.results
        } else if (taskOrSuite.type === 'suite') {
          const suite = taskOrSuite;
          processTasksInSuite(suite);
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

//  * @param {import('../../types').VitestSuite | import('../../types').VitestTask} suite
/**
 *
 * @param {import('../../types').VitestSuite} suite
 */
function processTasksInSuite(suite) {
  suite.tasks.forEach(task => {
    if (task.type === 'test') {
      console.log('test:', task.name);
      // process task.results
    } else if (task.type === 'suite') {
      processTasksInSuite(task);
    } else {
      throw new Error('Unprocessed case. Unknown task type');
    }
  });
}
