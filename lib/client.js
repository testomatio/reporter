const debug = require('debug')('@testomatio/reporter:client');
const createCallsiteRecord = require('callsite-record');
const { sep, join } = require('path');
const fs = require('fs');
const chalk = require('chalk');
const upload = require('./fileUploader');
const { PASSED, FAILED, FINISHED, APP_PREFIX } = require('./constants');
const pipesFactory = require('./pipe');

const { TESTOMATIO_ENV } = process.env;

class TestomatClient {
  /**
   * Create a Testomat client instance
   *
   * @param {*} params
   */
  constructor(params = {}) {
    this.title = params.title || process.env.TESTOMATIO_TITLE;
    this.createNewTests = params.createNewTests ?? !!process.env.TESTOMATIO_CREATE;
    this.proceed = process.env.TESTOMATIO_PROCEED;
    this.env = TESTOMATIO_ENV;
    this.parallel = params.parallel;
    const store = {};
    this.pipes = pipesFactory(params, store);
    this.queue = Promise.resolve();
    this.totalUploaded = 0;
    this.version = JSON.parse(fs.readFileSync(join(__dirname, '..', 'package.json')).toString()).version;
    console.log(APP_PREFIX, `Testomatio Reporter v${this.version}`);
  }

  /**
   * Used to create a new Test run
   *
   * @returns {Promise} - resolves to Run id which should be used to update / add test
   */
  createRun() {
    // all pipes disabled, skipping
    if (!this.pipes.filter(p => p.isEnabled).length) return;

    const runParams = {
      title: this.title,
      parallel: this.parallel,
      env: this.env,
    };

    global.testomatioArtifacts = [];

    this.queue = this.queue
      .then(() => Promise.all(this.pipes.map(p => p.createRun(runParams))))
      .catch(err => console.log(APP_PREFIX, err));
    debug('Run', this.queue);
    return this.queue;
  }

  /**
   * Used to add a new test to Run instance
   *
   * @returns {Promise}
   */
  async addTestRun(testId, status, testData = {}, storeArtifacts = undefined) {
    // all pipes disabled, skipping
    if (!this.pipes.filter(p => p.isEnabled).length) return;

    const {
      error = '',
      time = '',
      example = null,
      files = [],
      filesBuffers = [],
      steps,
      title,
      suite_title,
      suite_id,
      test_id,
    } = testData;
    let { message = '' } = testData;

    const uploadedFiles = [];

    if (testId) testData.test_id = testId;

    let stack = '';

    if (error) {
      stack = this.formatError(error);
      message = error.message;
    }
    if (steps) {
      stack = this.formatSteps(stack, steps);
    }

    //TODO: нужно еще проверить что бы не было кейса когда global.testomatioArtifacts и adapterArtifacts вместе отработали
    if (Array.isArray(storeArtifacts) && storeArtifacts.length) {
      files.push(...storeArtifacts);
      // storeArtifacts = []; //TODO: это обновляется что бы для каждого теста отсылался только 1 артефакт, сейчас же я шлю список, и это скорее неверно...Обсудить
    }

    if (Array.isArray(global.testomatioArtifacts)) { //TODO: need to test with new condition
      console.log("SENDS to global", global.testomatioArtifacts);
      files.push(...global.testomatioArtifacts);
      global.testomatioArtifacts = [];
    }

    for (const file of files) {
      uploadedFiles.push(upload.uploadFileByPath(file, this.runId));
    }

    for (const [idx, buffer] of filesBuffers.entries()) {
      const fileName = `${idx + 1}-${title.replace(/\s+/g, '-')}`;
      uploadedFiles.push(upload.uploadFileAsBuffer(buffer, fileName, this.runId));
    }

    const artifacts = await Promise.all(uploadedFiles);

    global.testomatioArtifacts = [];

    this.totalUploaded += uploadedFiles.filter(n => n).length;

    const data = {
      files,
      steps,
      status,
      stack,
      example,
      title,
      suite_title,
      suite_id,
      test_id,
      message,
      run_time: parseFloat(time),
      artifacts,
    };

    this.queue = this.queue
      .then(() => Promise.all(this.pipes.map(p => p.addTest(data))))
      .catch(err => console.log(APP_PREFIX, err));
    return this.queue;
  }

  /**
   * Update run status
   *
   * @returns {Promise}
   */
  updateRunStatus(status, isParallel) {
    // all pipes disabled, skipping
    if (!this.pipes.filter(p => p.isEnabled).length) return;

    let statusEvent;
    if (status === FINISHED) statusEvent = 'finish';
    if (status === PASSED) statusEvent = 'pass';
    if (status === FAILED) statusEvent = 'fail';
    if (isParallel) statusEvent += '_parallel';
    const runParams = { status, statusEvent };

    this.queue = this.queue
      .then(() => Promise.all(this.pipes.map(p => p.finishRun(runParams))))
      .catch(err => console.log(APP_PREFIX, err));

    if (upload.isArtifactsEnabled() && this.totalUploaded > 0) {
      console.log(
        APP_PREFIX,
        `🗄️  Total ${this.totalUploaded} artifacts ${
          process.env.TESTOMATIO_PRIVATE_ARTIFACTS ? 'privately' : chalk.bold('publicly')
        } uploaded to S3 bucket  `,
      );
    }
    return this.queue;
  }

  formatSteps(stack, steps) {
    return stack ? `${steps}\n\n${chalk.bold.red('################[ Failure ]################')}\n${stack}` : steps;
  }

  formatError(error, message) {
    if (!message) message = error.message;
    if (error.inspect) message = error.inspect() || '';

    let stack = `\n${chalk.bold(message)}\n`;

    // diffs for mocha, cypress, codeceptjs style
    if (error.actual && error.expected) {
      stack += `\n\n${chalk.bold.green('+ expected')} ${chalk.bold.red('- actual')}`;
      stack += `\n${chalk.red(`- ${error.actual.toString().split('\n').join('\n- ')}`)}`;
      stack += `\n${chalk.green(`+ ${error.expected.toString().split('\n').join('\n+ ')}`)}`;
      stack += '\n\n';
    }

    try {
      const record = createCallsiteRecord({
        forError: error,
      });
      if (record && !record.filename.startsWith('http')) {
        stack += record.renderSync({
          stackFilter: frame =>
            frame.getFileName().indexOf(sep) > -1 &&
            frame.getFileName().indexOf('node_modules') < 0 &&
            frame.getFileName().indexOf('internal') < 0,
        });
      }
      return stack;
    } catch (e) {
      console.log(e);
    }
  }
}

module.exports = TestomatClient;
