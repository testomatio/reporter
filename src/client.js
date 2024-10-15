import createDebugMessages from 'debug';
import createCallsiteRecord from 'callsite-record';
import { minimatch } from 'minimatch';
import fs from 'fs';
import pc from 'picocolors';
import { randomUUID } from 'crypto';
import { APP_PREFIX, STATUS } from './constants.js';
import { pipesFactory } from './pipe/index.js';
import { glob } from 'glob';
import path, { sep} from 'path';
import { fileURLToPath } from 'node:url';
import { S3Uploader } from './uploader.js';
import { storeRunId } from './utils/utils.js';

const debug = createDebugMessages('@testomatio/reporter:client');

// removed __dirname usage, because:
// 1. replaced with ESM syntax (import.meta.url), but it throws an error on tsc compilation;
// 2. got error "__dirname already defined" in compiles js code (cjs dir) 

let listOfTestFilesToExcludeFromReport = null;

/**
 * @typedef {import('../types').TestData} TestData
 * @typedef {import('../types').PipeResult} PipeResult
 */

class Client {
  /**
   * Create a Testomat client instance
   * @returns
   */
  // eslint-disable-next-line 
  constructor(params = {}) {
    this.paramsForPipesFactory = params;
    this.pipeStore = {};
    this.runId = randomUUID(); // will be replaced by real run id
    this.queue = Promise.resolve();

    // @ts-ignore this line will be removed in compiled code, because __dirname is defined in commonjs
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const pathToPackageJSON = path.join(__dirname, '../package.json');
    try {
      this.version = JSON.parse(fs.readFileSync(pathToPackageJSON).toString()).version;
      console.log(APP_PREFIX, `Testomatio Reporter v${this.version}`);
    } catch (e) {
      // do nothing
    }
    this.executionList = Promise.resolve();

    this.uploader = new S3Uploader();
    this.uploader.checkEnabled();

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
    this.pipes = await pipesFactory(params || this.paramsForPipesFactory || {}, this.pipeStore);
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
  async createRun(params) {
    if (!this.pipes || !this.pipes.length)
      this.pipes = await pipesFactory(params || this.paramsForPipesFactory || {}, this.pipeStore);
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

    // @ts-ignore
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

    // @ts-ignore
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
        debug('TOTAL artifacts', this.uploader.totalUploadsCount);
        debug(`${this.uploader.skippedUploadsCount} artifacts skipped`);

        if (this.uploader.totalUploadsCount && this.uploader.isEnabled) {
          console.log(
            APP_PREFIX,
            `🗄️ ${this.uploader.totalUploadsCount} artifacts ${
              process.env.TESTOMATIO_PRIVATE_ARTIFACTS ? 'privately' : pc.bold('publicly')
            } uploaded to S3 bucket`,
          );

          if (this.uploader.failedUploadsCount) {
            console.log(
              APP_PREFIX,
              pc.gray('[CLIENT]'),
              `${this.uploader.failedUploadsCount} artifacts failed to upload`,
            );
          }

          if (this.uploader.isEnabled && this.uploader.skippedUploadsCount) {
            console.log(APP_PREFIX, `${pc.bold(this.uploader.skippedUploadsCount)} artifacts skipped to upload`);
          }
  
          if (this.uploader.skippedUploadsCount || this.uploader.failedUploadsCount) {
            const command = `TESTOMATIO_RUN=${this.runId} npx @testomatio/reporter upload-artifacts`;
            console.log(
              APP_PREFIX,
              `Run "${pc.magenta(command)}" with valid S3 credentials to upload skipped & failed artifacts`,
            );
          }
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
    if (steps) testLogs += `${pc.bold(pc.blue('################[ Steps ]################'))}\n${steps}\n\n`;
    if (logs) testLogs += `${pc.bold(pc.gray('################[ Logs ]################'))}\n${logs}\n\n`;
    if (error) testLogs += `${pc.bold(pc.red('################[ Failure ]################'))}\n${error}`;
    return testLogs;
  }

  formatError(error, message) {
    if (!message) message = error.message;
    if (error.inspect) message = error.inspect() || '';

    let stack = '';
    if (error.name) stack += `${pc.red(error.name)}`;
    if (error.operator) stack += ` (${pc.red(error.operator)})`;
    // add new line if something was added to stack
    if (stack) stack += ': ';

    stack += `${message}\n`;

    if (error.diff) {
      // diff for vitest
      stack += error.diff;
      stack += '\n\n';
    } else if (error.actual && error.expected && error.actual !== error.expected) {
      // diffs for mocha, cypress, codeceptjs style
      stack += `\n\n${pc.bold(pc.green('+ expected'))} ${pc.bold(pc.red('- actual'))}`;
      stack += `\n${pc.green(`+ ${error.expected.toString().split('\n').join('\n+ ')}`)}`;
      stack += `\n${pc.red(`- ${error.actual.toString().split('\n').join('\n- ')}`)}`;
      stack += '\n\n';
    }

    const customFilter = process.env.TESTOMATIO_STACK_IGNORE;

    try {
      let hasFrame = false;
      const record = createCallsiteRecord({
        forError: error,
        isCallsiteFrame: frame => {
          if (customFilter && minimatch(frame.fileName, customFilter)) return false;
          if (hasFrame) return false;
          if (isNotInternalFrame(frame)) hasFrame = true;
          return hasFrame;
        },
      });
      // @ts-ignore
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

export function formatStep(step, shift = 0) {
  const prefix = ' '.repeat(shift);

  const lines = [];

  if (step.error) {
    lines.push(`${prefix}${pc.red(step.title)} ${pc.gray(`${step.duration}ms`)}`);
  } else {
    lines.push(`${prefix}${step.title} ${pc.gray(`${step.duration}ms`)}`);
  }

  for (const child of step.steps || []) {
    lines.push(...formatStep(child, shift + 2));
  }

  return lines;
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

export { Client };
export default Client;
