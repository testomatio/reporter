const debug = require('debug')('@testomatio/reporter:client');
const createCallsiteRecord = require('callsite-record');
const { sep, join } = require('path');
const { minimatch } = require('minimatch');
const fs = require('fs');
const chalk = require('chalk');
const { randomUUID } = require('crypto');
const S3Uploader = require('./uploader');
const { APP_PREFIX, STATUS } = require('./constants');
const pipesFactory = require('./pipe');
const { glob } = require('glob');
const path = require('path');
const { storeRunId, formatStep } = require('./utils/utils');
const { filesize: prettyBytes } = require('filesize');

let listOfTestFilesToExcludeFromReport = null;

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
    this.pipeStore = {};
    this.runId = randomUUID(); // will be replaced by real run id
    this.pipes = pipesFactory(params, this.pipeStore);
    this.queue = Promise.resolve();
    this.version = JSON.parse(fs.readFileSync(join(__dirname, '..', 'package.json')).toString()).version;
    this.executionList = Promise.resolve();
    this.uploader = new S3Uploader();
    this.uploader.checkEnabled();

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
          `At the moment processing is available only for the "testomatio" key. Example: "testomatio:tag-name=xxx"`,
        );
        return;
      }

      const results = await Promise.all(
        this.pipes.map(async p => ({ pipe: p.toString(), result: await p.prepareRun(pipeOptions) })),
      );

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

    this.queue = this.queue
      .then(() => Promise.all(this.pipes.map(p => p.createRun())))
      .catch(err => console.log(APP_PREFIX, err))
      .then(() => {
        const runId = this.pipeStore?.runId;
        if (runId) this.runId = runId;
        storeRunId(this.runId);

        this.uploader.checkEnabled();
      })
      .then(() => undefined); // fixes return type

    // debug('Run', this.queue);
    return this.queue;
  }

  /**
   * Updates test status and its data
   *
   * @param {string|undefined} status
   * @param {TestData} [testData]
   * @returns {Promise<PipeResult[]>}
   */
  async addTestRun(status, testData) {
    // all pipes disabled, skipping
    if (!this.pipes?.filter(p => p.isEnabled).length) return [];

    if (isTestShouldBeExculedFromReport(testData)) return [];

    if (status === STATUS.SKIPPED && process.env.TESTOMATIO_EXCLUDE_SKIPPED) {
      debug('Skipping test from report', testData?.title);
      return []; // do not log skipped tests
    }

    if (!testData)
      testData = {
        title: 'Unknown test',
        suite_title: 'Unknown suite',
      };

    /**
     * @type {TestData}
     */
    const {
      rid,
      error = null,
      time = 0,
      example = null,
      files = [],
      filesBuffers = [],
      steps,
      code = null,
      title,
      file,
      suite_title,
      suite_id,
      test_id,
      manuallyAttachedArtifacts,
      meta,
    } = testData;
    let { message = '' } = testData;

    let errorFormatted = '';
    if (error) {
      errorFormatted += this.formatError(error) || '';
      message = error?.message;
    }

    // Attach logs
    const fullLogs = this.formatLogs({ error: errorFormatted, steps, logs: testData.logs });

    // add artifacts
    if (manuallyAttachedArtifacts?.length) files.push(...manuallyAttachedArtifacts);

    const uploadedFiles = [];

    for (let f of files) {
      if (typeof f === 'object') {
        if (!f.path) continue;

        f = f.path;
      }

      uploadedFiles.push(this.uploader.uploadFileByPath(f, [this.runId, rid, path.basename(f)]));
    }

    for (const [idx, buffer] of filesBuffers.entries()) {
      const fileName = `${idx + 1}-${title.replace(/\s+/g, '-')}`;
      uploadedFiles.push(this.uploader.uploadFileAsBuffer(buffer, [this.runId, rid, fileName]));
    }

    const artifacts = (await Promise.all(uploadedFiles)).filter(n => !!n);

    const data = {
      rid,
      files,
      steps,
      status,
      stack: fullLogs,
      example,
      file,
      code,
      title,
      suite_title,
      suite_id,
      test_id,
      message,
      run_time: typeof time === 'number' ? time : parseFloat(time),
      artifacts,
      meta,
    };

    // debug('Adding test run...', data);

    this.queue = this.queue.then(() =>
      Promise.all(
        this.pipes.map(async pipe => {
          try {
            const result = await pipe.addTest(data);
            return { pipe: pipe.toString(), result };
          } catch (err) {
            console.log(APP_PREFIX, pipe.toString(), err);
          }
        }),
      ),
    );

    return this.queue;
  }

  /**
   *
   * Updates the status of the current test run and finishes the run.
   * @param {'passed' | 'failed' | 'skipped' | 'finished'} status - The status of the current test run.
   * Must be one of "passed", "failed", or "finished"
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
        if (this.uploader.totalSuccessfulUploadsCount && this.uploader.isEnabled) {
          console.log(
            APP_PREFIX,
            `🗄️ ${this.uploader.totalSuccessfulUploadsCount} artifacts ${
              process.env.TESTOMATIO_PRIVATE_ARTIFACTS ? 'privately' : chalk.bold('publicly')
            } 🟢 uploaded to S3 bucket`,
          );
        }

        const filesizeStrMaxLength = 7;

        if (this.uploader.failedUploads.length) {
          console.log(
            '\n',
            APP_PREFIX,
            `🗄️ ${this.uploader.failedUploads.length} artifacts 🔴${chalk.bold('failed')} to upload`,
          );
          const failedUploads = this.uploader.failedUploads.map(file => ({
            relativePath: file.path.replace(process.cwd(), ''),
            sizePretty: prettyBytes(file.size, { round: 0 }).toString(),
          }));

          const pathPadding = Math.max(...failedUploads.map(upload => upload.relativePath.length)) + 1;

          failedUploads.forEach(upload => {
            console.log(
              `  ${chalk.gray('|')} 🔴 ${upload.relativePath.padEnd(pathPadding)} ${chalk.gray(
                `| ${upload.sizePretty.padStart(filesizeStrMaxLength)} |`,
              )}`,
            );
          });
        }

        if (this.uploader.isEnabled && this.uploader.skippedUploads.length) {
          console.log(
            '\n',
            APP_PREFIX,
            `🗄️ ${chalk.bold(this.uploader.skippedUploads.length)} artifacts uploading 🟡${chalk.bold(
              'skipped',
            )} (due to large size)`,
          );
          const skippedUploads = this.uploader.skippedUploads.map(file => ({
            relativePath: file.path.replace(process.cwd(), ''),
            sizePretty: file.size === null ? 'unknown' : prettyBytes(file.size, { round: 0 }).toString(),
          }));
          const pathPadding = Math.max(...skippedUploads.map(upload => upload.relativePath.length)) + 1;
          skippedUploads.forEach(upload => {
            console.log(
              `  ${chalk.gray('|')} 🟡 ${upload.relativePath.padEnd(pathPadding)} ${chalk.gray(
                `| ${upload.sizePretty.padStart(filesizeStrMaxLength)} |`,
              )}`,
            );
          });
        }

        if (this.uploader.skippedUploads.length || this.uploader.failedUploads.length) {
          const command = `TESTOMATIO=<your_api_key> TESTOMATIO_RUN=${
            this.runId
          } npx @testomatio/reporter upload-artifacts`;
          console.log(
            APP_PREFIX,
            `Run "${chalk.magenta(command)}" with valid S3 credentials to upload skipped & failed artifacts`,
          );
        }
      })
      .catch(err => console.log(APP_PREFIX, err));

    return this.queue;
  }

  /**
   * Returns the formatted stack including the stack trace, steps, and logs.
   * @returns {string}
   */
  formatLogs({ error, steps, logs }) {
    error = error?.trim();
    logs = logs?.trim();

    if (Array.isArray(steps)) {
      steps = steps
        .map(step => formatStep(step))
        .flat()
        .join('\n');
    }

    let testLogs = '';
    if (steps) testLogs += `${chalk.bold.blue('################[ Steps ]################')}\n${steps}\n\n`;
    if (logs) testLogs += `${chalk.bold.gray('################[ Logs ]################')}\n${logs}\n\n`;
    if (error) testLogs += `${chalk.bold.red('################[ Failure ]################')}\n${error}`;
    return testLogs;
  }

  formatError(error, message) {
    if (!message) message = error.message;
    if (error.inspect) message = error.inspect() || '';

    let stack = '';
    if (error.name) stack += `${chalk.red(error.name)}`;
    if (error.operator) stack += ` (${chalk.red(error.operator)})`;
    // add new line if something was added to stack
    if (stack) stack += ': ';

    stack += `${message}\n`;

    if (error.diff) {
      // diff for vitest
      stack += error.diff;
      stack += '\n\n';
    } else if (error.actual && error.expected && error.actual !== error.expected) {
      // diffs for mocha, cypress, codeceptjs style
      stack += `\n\n${chalk.bold.green('+ expected')} ${chalk.bold.red('- actual')}`;
      stack += `\n${chalk.green(`+ ${error.expected.toString().split('\n').join('\n+ ')}`)}`;
      stack += `\n${chalk.red(`- ${error.actual.toString().split('\n').join('\n- ')}`)}`;
      stack += '\n\n';
    }

    const customFilter = process.env.TESTOMATIO_STACK_IGNORE;

    try {
      let hasFrame = false;
      const record = createCallsiteRecord({
        forError: error,
        isCallsiteFrame: frame => {
          if (customFilter && minimatch(frame.getFileName(), customFilter)) return false;
          if (hasFrame) return false;
          if (isNotInternalFrame(frame)) hasFrame = true;
          return hasFrame;
        },
      });
      if (record && !record.filename.startsWith('http')) {
        stack += record.renderSync({ stackFilter: isNotInternalFrame });
      }
      return stack;
    } catch (e) {
      console.log(e);
    }
  }
}

function isNotInternalFrame(frame) {
  return (
    frame.getFileName() &&
    frame.getFileName().includes(sep) &&
    !frame.getFileName().includes('node_modules') &&
    !frame.getFileName().includes('internal')
  );
}

/**
 *
 * @param {TestData} testData
 * @returns boolean
 */
function isTestShouldBeExculedFromReport(testData) {
  // const fileName = path.basename(test.location?.file || '');
  const globExcludeFilesPattern = process.env.TESTOMATIO_EXCLUDE_FILES_FROM_REPORT_GLOB_PATTERN;
  if (!globExcludeFilesPattern) return false;

  if (!testData.file) {
    debug('No "file" property found for test ', testData.title);
    return false;
  }

  const excludeParretnsList = globExcludeFilesPattern.split(';');

  // as scanning files is time consuming operation, just save the result in variable to avoid multiple scans
  if (!listOfTestFilesToExcludeFromReport) {
    // list of files with relative paths
    listOfTestFilesToExcludeFromReport = glob.sync(excludeParretnsList, { ignore: '**/node_modules/**' });
    debug('Tests from next files will not be reported:', listOfTestFilesToExcludeFromReport);
  }

  const testFileRelativePath = path.relative(process.cwd(), testData.file);

  // no files found matching the exclusion pattern
  if (!listOfTestFilesToExcludeFromReport.length) return false;

  if (listOfTestFilesToExcludeFromReport.includes(testFileRelativePath)) {
    debug(`Excluding test '${testData.title}' <${testFileRelativePath}> from reporting`);
    return true;
  }
  return false;
}

module.exports = Client;
module.exports.TestomatioClient = Client;
