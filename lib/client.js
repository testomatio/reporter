const debug = require('debug')('@testomatio/reporter:client');
const createCallsiteRecord = require('callsite-record');
const { sep, join } = require('path');
const fs = require('fs');
const chalk = require('chalk');
const { randomUUID } = require('crypto');
const upload = require('./fileUploader');
const { APP_PREFIX } = require('./constants');
const pipesFactory = require('./pipe');

/**
 * @typedef {import('../types').TestData} TestData
 * @typedef {import('../types').RunStatus} RunStatus
 * @typedef {import('../types').PipeResult} PipeResult
 */

class Client {
  /**
   * Create a Testomat client instance
   *
   * @param {*} params
   */
  constructor(params = {}) {
    const store = {};
    this.uuid = randomUUID();
    this.pipes = pipesFactory(params, store);
    this.queue = Promise.resolve();
    this.totalUploaded = 0;
    this.version = JSON.parse(fs.readFileSync(join(__dirname, '..', 'package.json')).toString()).version;
    this.executionList = Promise.resolve();

    console.log(APP_PREFIX, `Testomatio Reporter v${this.version}`);
  }

  /**
   * Asynchronously prepares the execution list for running tests through various pipes.
   * Each pipe in the client is checked for enablement, 
   * and if all pipes are disabled, the function returns a resolved Promise.
   * Otherwise, it executes the `prepareRun` method for each enabled pipe and collects the results.
   * The results are then filtered to remove any undefined values.
   * If no valid results are found, the function returns undefined.
   * Otherwise, it returns the first non-empty array from the filtered results.
   *
   * @param {Object} params - The options for preparing the test execution list.
   * @param {string} params.pipe - Name of the executed pipe.
   * @param {string} params.pipeOptions - Filter option.
   * @returns {Promise<any>} - A Promise that resolves to an 
   * array containing the prepared execution list,
   * or resolves to undefined if no valid results are found or if all pipes are disabled.
   */
  async prepareRun(params) {
    const { pipe, pipeOptions } = params;
    // all pipes disabled, skipping
    if (!this.pipes.some(p => p.isEnabled)) {
      return Promise.resolve();
    }

    try {
      const filterPipe = this.pipes.find(p => p.constructor.name.toLowerCase() === `${pipe.toLowerCase()}pipe`);

      if (!filterPipe.isEnabled) {
        // TODO:for the future for the another pipes
        console.warn(
          APP_PREFIX, 
          `At the moment processing is available only for the "testomatio" key. Example: "testomatio:tag-name=xxx"`
        );
        return;
      }

      const results = await Promise.all(this.pipes.map(async p => 
        ({ pipe: p.toString(), result: await p.prepareRun(pipeOptions) })  
      ));
    
      const result = results.filter(p => p.pipe.includes('Testomatio'))[0]?.result;

      if (!result || result.length === 0) {
        return;
      } 
  
      debug('Execution tests list', result);

      return result;
    } catch (err) {
      console.error(APP_PREFIX, err);
    }
  }

  /**
   * Used to create a new Test run
   *
   * @returns {Promise<any>} - resolves to Run id which should be used to update / add test
   */
  createRun() {
    debug('Creating run...');
    // all pipes disabled, skipping
    if (!this.pipes?.filter(p => p.isEnabled).length) return Promise.resolve();

    global.testomatioArtifacts = [];
    if (!global.testomatioDataStore) global.testomatioDataStore = {};

    this.queue = this.queue
      .then(() => Promise.all(this.pipes.map(p => p.createRun())))
      .catch(err => console.log(APP_PREFIX, err))
      .then(() => undefined); // fixes return type
    // debug('Run', this.queue);
    return this.queue;
  }

  /**
   * Updates test status and its data
   *
   * @param {string|undefined} status
   * @param {TestData} [testData]
   * @param {string[]} [storeArtifacts]
   * @returns {Promise<PipeResult[]>}
   */
  async addTestRun(status, testData, storeArtifacts = []) {
    debug('Adding test run for test', testData?.test_id || 'unknown test');
    // all pipes disabled, skipping
    if (!this.pipes?.filter(p => p.isEnabled).length) return [];

    if (!testData)
      testData = {
        title: 'Unknown test',
        suite_title: 'Unknown suite',
      };

    const {
      error = null,
      time = '',
      example = null,
      files = [],
      filesBuffers = [],
      steps,
      code = null,
      title,
      suite_title,
      suite_id,
      test_id,
    } = testData;
    let { message = '' } = testData;

    const uploadedFiles = [];

    let stack = '';

    if (error) {
      stack = this.formatError(error) || '';
      message = error?.message;
    }
    if (steps) {
      stack = this.formatSteps(stack, steps);
    }

    stack += testData.stack || '';

    // in some cases (e.g. using cucumber) logger instance becomes empty object, if import at the top of the file
    const logger = require('./logger');
    const testLogs = logger.getLogs(test_id);
    // debug(`Test logs for ${test_id}:\n`, testLogs);
    if (stack) stack += '\n\n';
    stack += testLogs ? `${chalk.bold('Logs:')}\n${testLogs}` : '';

    if (Array.isArray(storeArtifacts) && storeArtifacts.length) {
      debug('CLIENT storeArtifact', storeArtifacts);
      files.push(...storeArtifacts);
    }

    if (Array.isArray(global.testomatioArtifacts)) {
      debug('CLIENT global[testomatioArtifacts]', global.testomatioArtifacts);
      files.push(...global.testomatioArtifacts);
      global.testomatioArtifacts = [];
    }

    for (const file of files) {
      uploadedFiles.push(upload.uploadFileByPath(file, this.uuid));
    }

    for (const [idx, buffer] of filesBuffers.entries()) {
      const fileName = `${idx + 1}-${title.replace(/\s+/g, '-')}`;
      uploadedFiles.push(upload.uploadFileAsBuffer(buffer, fileName, this.uuid));
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
      code,
      title,
      suite_title,
      suite_id,
      test_id,
      message,
      run_time: parseFloat(time),
      artifacts,
    };

    this.queue = this.queue.then(() =>
      Promise.all(
        this.pipes.map(async p => {
          try {
            const result = await p.addTest(data);
            return { pipe: p.toString(), result };
          } catch (err) {
            console.log(APP_PREFIX, p.toString(), err);
          }
        }),
      ),
    );

    return this.queue;
  }

  /**
   *
   * Updates the status of the current test run and finishes the run.
   * @param {RunStatus} status - The status of the current test run. Must be one of "passed", "failed", or "finished"
   * @param {boolean} [isParallel] - Whether the current test run was executed in parallel with other tests.
   * @returns {Promise<any>} - A Promise that resolves when finishes the run.
   */
  updateRunStatus(status, isParallel = false) {
    debug('Updating run status...');
    // all pipes disabled, skipping
    if (!this.pipes?.filter(p => p.isEnabled).length) return Promise.resolve();

    const runParams = { status, parallel: isParallel };

    this.queue = this.queue
      .then(() => Promise.all(this.pipes.map(p => p.finishRun(runParams))))
      .then(() => {
        debug('TOTAL uploaded files', this.totalUploaded);

        if (upload.isArtifactsEnabled() && this.totalUploaded > 0) {
          console.log(
            APP_PREFIX,
            `🗄️  Total ${this.totalUploaded} artifacts ${
              process.env.TESTOMATIO_PRIVATE_ARTIFACTS ? 'privately' : chalk.bold('publicly')
            } uploaded to S3 bucket  `,
          );
        }
      })
      .catch(err => console.log(APP_PREFIX, err));

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

module.exports = Client;
