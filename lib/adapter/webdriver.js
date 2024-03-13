// eslint-disable-next-line global-require, import/no-extraneous-dependencies
const WDIOReporter = require('@wdio/reporter').default;
const debug = require('debug')('@testomatio/reporter:adapter:webdriver');
const TestomatClient = require('../client');
const chalk = require('chalk');
const { STATUS, TESTOMAT_TMP_STORAGE_DIR, APP_PREFIX } = require('../constants');
const { parseTest, fileSystem } = require('../utils/utils');
const { services } = require('../services');

class WebdriverReporter extends WDIOReporter {
  constructor(options) {
    super(options);

    this._addTestPromises = [];
    this._isSynchronising = false;
    this._specs = new Map();
    this._currentCid = "cid";
    this.passedTestCunter = 0;
    this.failedTestCunter = 0;
    this.skippedTestCunter = 0;

    this.client = new TestomatClient({ apiKey: options?.apiKey });
    options = Object.assign(
      options, 
      { 
        stdout: true,
        reporterSyncTimeout: 3 * 60 * 1000, //3 min default reporte timeout
        reporterSyncInterval: 1000,
      });

    // fileSystem.clearDir(TESTOMAT_TMP_STORAGE_DIR);

  }

  get isSynchronised () {
    return this._addTestPromises.length === 0;
  }

  onRunnerStart(runner) {
    if (!this.client) return;

    // TODO: need to create parallel execution based on the new file storage???
    this.client.createRun();

    this._currentCid = runner.cid;
    this._specs.set(runner.cid, runner);
  }

  // onSuiteStart(suiteStats) {
  //   services.setContext(this.replaceDotsWithTitle(suiteStats.fullTitle));
  // }

  // onSuiteEnd() {
  //   services.setContext(null);
  // }

  // onTestStart(test) {
  //   services.setContext(test?.title);
  // }

  // onTestEnd() {
  //   services.setContext(null);
  // }

  onTestPass(test) {
    debug(chalk.bold.green('✔'), test.fullTitle);

    this.passedTestCunter += 1;

    const logs = this.getTestLogs(test);
    const artifacts = services.artifacts.get(test.fullTitle);
    const keyValues = services.keyValues.get(test.fullTitle);

    const opts = {
      logs,
      artifacts,
      keyValues
    }

    this._addTestPromises.push(this.addTest(test, opts));    
  }

  onTestFail(test) {
    debug(chalk.bold.green('✖'), test.fullTitle);

    this.failedTestCunter += 1;
    let screenshotsBuffers = undefined, 
      testError = undefined;

    if (test.output) {
      const screenshotEndpoint = /\/session\/[^/]*(\/element\/[^/]*)?\/screenshot/;
      screenshotsBuffers = test?.output
        .filter(el => el.endpoint === screenshotEndpoint && el.result && el.result.value)
        .map(el => Buffer.from(el.result.value, 'base64'));
    }

    if (test.error && test.error?.trim()) {
      testError = test?.error;
    }

    const logs = this.getTestLogs(test);

    const opts = {
      filesBuffers: screenshotsBuffers,
      error: testError,
      logs
    }

    this._addTestPromises.push(this.addTest(test, opts));
  }

  onTestSkip(test) {
    debug(chalk.bold.green('skip: %s'), test.fullTitle);

    this.skippedTestCunter += 1;
    this._addTestPromises.push(this.addTest(test)); 
  }

  async onRunnerEnd(runnerStats) {
    this._isSynchronising = true;

    (async () => {
      if (this.client) {
        console.log(APP_PREFIX, `onRunnerEnd: ${this._currentCid} awaiting report generation`);
        await Promise.all(this._addTestPromises);

        // end of test execution processing
        const emoji = runnerStats.failures === 0 ? '🟢' : '🔴';
        const finishStatus = runnerStats.failures === 0 ? STATUS.PASSED : STATUS.FAILED;
        debug(`WDIO tests ended with status = ${finishStatus}`);

        console.log(APP_PREFIX, emoji, `Runner exited with ${chalk.bold(finishStatus)}`);
        console.log(chalk.bold(`Runner exited with ${finishStatus}`), `: ${this.passedTestCunter} passed, ${this.failedTestCunter} failed, ${this.skippedTestCunter} skipped`);

        await this.client.updateRunStatus(finishStatus, this._isSynchronising);
      }
    })();

    this._addTestPromises = [];
    this._isSynchronising = false;
  }

  async addTest(test, opts = {}) {
    if (!this.client) return;

    const { title, _duration: duration, state, parent } = test;
    const testId = parseTest(title);

    await this.client.addTestRun(state, {
      error: opts.error,
      title,
      test_id: testId,
      time: duration,
      filesBuffers: opts.filesBuffers || [],
      suite_title: parent,
      logs: opts.logs,
      manuallyAttachedArtifacts: opts.artifacts,
      meta: opts.keyValues,
    });
  }

  replaceDotsWithTitle(title) {
    if (title.trim() === '') {
      return "Empty test title.";
    }

    let result = '';
    let insideDot = false;

    for (let i = 0; i < title.length; i++) {
        if (title[i] === '.') {
          if (insideDot) {
              result += '-';
          } else {
              insideDot = true;
          }
        } else {
          result += title[i];
          insideDot = false;
        }
    }

    return result;
  }

  getTestLogs(test) {
    const suiteLogsArr = services.logger.getLogs(test.parent);
    const suiteLogs = suiteLogsArr ? suiteLogsArr.join('\n').trim() : '';
    const testLogsArr = services.logger.getLogs(test.title);
    const testLogs = testLogsArr ? testLogsArr.join('\n').trim() : '';
  
    let logs = '';
    //TODO: how test it? to @oleksandr
    if (suiteLogs) {
      logs += `${chalk.bold('\t--- BeforeSuite ---')}\n${suiteLogs}`;
    }
    if (testLogs) {
      logs += `\n${chalk.bold('\t--- Test ---')}\n${testLogs}`;
    }
    return logs;
  }
}

module.exports = WebdriverReporter;
