import createDebugMessages from 'debug';
import createCallsiteRecord from 'callsite-record';
import { minimatch } from 'minimatch';
import fs from 'fs';
import pc from 'picocolors';
import { randomUUID } from 'crypto';
import { APP_PREFIX, STATUS } from './constants.js';
import { pipesFactory } from './pipe/index.js';
import { glob } from 'glob';
import path, { sep } from 'path';
import { fileURLToPath } from 'node:url';
import { S3Uploader } from './uploader.js';
import { formatStep, readLatestRunId, storeRunId, validateSuiteId } from './utils/utils.js';
import { filesize as prettyBytes } from 'filesize';

const debug = createDebugMessages('@testomatio/reporter:client');

// removed __dirname usage, because:
// 1. replaced with ESM syntax (import.meta.url), but it throws an error on tsc compilation;
// 2. got error "__dirname already defined" in compiles js code (cjs dir)

let listOfTestFilesToExcludeFromReport = null;

/**
 * @typedef {import('../types/types.js').TestData} TestData
 * @typedef {import('../types/types.js').PipeResult} PipeResult
 */

class Client {
  /**
   * Create a Testomat client instance
   * @returns
   */
  constructor(params = {}) {
    this.paramsForPipesFactory = params;
    this.pipeStore = {};
    this.runId = '';
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

      if (!filterPipe?.isEnabled) {
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
      })
      .then(() => this.uploader.checkEnabled())
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
    if (!this.pipes || !this.pipes.length)
      this.pipes = await pipesFactory(this.paramsForPipesFactory || {}, this.pipeStore);

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

    // Add timestamp if not already present (microseconds since Unix epoch)
    if (!testData.timestamp && !process.env.TESTOMATIO_NO_TIMESTAMP) {
      testData.timestamp = Math.floor((performance.timeOrigin + performance.now()) * 1000);
    }

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
      timestamp,
      manuallyAttachedArtifacts,
      labels,
      overwrite,
    } = testData;
    let { message = '', meta = {} } = testData;

    // stringify meta values and limit keys and values length to 255
    meta = Object.entries(meta)
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([key, value]) => {
        try {
          if (typeof value === 'object') {
            value = JSON.stringify(value);
          } else if (typeof value !== 'string') {
            try {
              value = value.toString();
            } catch (err) {
              console.warn(APP_PREFIX, `Can't convert meta value to string`, err);
            }
          }

          if (value?.length > 255) {
            value = value.substring(0, 255);
            debug(APP_PREFIX, `Meta info value "${value}" is too long, trimmed to 255 characters`);
          }

          if (key?.length > 255) {
            const newKey = key.substring(0, 255);
            debug(APP_PREFIX, `Meta info key "${key}" is too long, trimmed to 255 characters`);
            return [newKey, value];
          }

          return [key, value];
        } catch (err) {
          debug(APP_PREFIX, `Error while processing meta info key ${key}`, err);
          return [null, null];
        }
      })
      .reduce((acc, [key, value]) => {
        if (key) acc[key] = value;
        return acc;
      }, {});

    // Labels are simple array of strings, no processing needed

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
      if (!f) continue; // f === null
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

    const workspaceDir = process.env.TESTOMATIO_WORKDIR || process.cwd();
    const relativeFile = file ? path.relative(workspaceDir, file) : file;
    const rootSuiteId = validateSuiteId(process.env.TESTOMATIO_SUITE);

    const data = {
      rid,
      files,
      steps,
      status,
      stack: fullLogs,
      example,
      file: relativeFile,
      code,
      title,
      suite_title,
      suite_id,
      test_id,
      message,
      run_time: typeof time === 'number' ? time : parseFloat(time),
      timestamp,
      artifacts,
      meta,
      labels,
      overwrite,
      ...(rootSuiteId && { root_suite_id: rootSuiteId }),
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
  async updateRunStatus(status, isParallel = false) {
    this.pipes ||= await pipesFactory(this.paramsForPipesFactory || {}, this.pipeStore);
    this.runId ||= readLatestRunId();

    debug('Updating run status...');
    // all pipes disabled, skipping
    if (!this.pipes?.filter(p => p.isEnabled).length) return Promise.resolve();

    const runParams = { status, parallel: isParallel };

    this.queue = this.queue
      .then(() => Promise.all(this.pipes.map(p => p.finishRun(runParams))))
      .then(() => {
        if (!this.uploader.isEnabled) return;

        const filesizeStrMaxLength = 7;

        if (this.uploader.successfulUploads.length) {
          debug('\n', APP_PREFIX, `🗄️ ${this.uploader.successfulUploads.length} artifacts uploaded to S3 bucket`);
          const uploadedArtifacts = this.uploader.successfulUploads.map(file => ({
            relativePath: file.path.replace(process.cwd(), ''),
            link: file.link,
            sizePretty: prettyBytes(file.size, { round: 0 }).toString(),
          }));

          uploadedArtifacts.forEach(upload => {
            debug(
              `🟢Uploaded artifact`,
              `${upload.relativePath},`,
              'size:',
              `${upload.sizePretty},`,
              'link:',
              `${upload.link}`,
            );
          });
        }

        if (this.uploader.failedUploads.length) {
          console.log(
            APP_PREFIX,
            `🗄️ ${this.uploader.failedUploads.length} artifacts 🔴${pc.bold('failed')} to upload`,
          );
          const failedUploads = this.uploader.failedUploads.map(file => ({
            relativePath: file.path.replace(process.cwd(), ''),
            sizePretty: prettyBytes(file.size, { round: 0 }).toString(),
          }));

          const pathPadding = Math.max(...failedUploads.map(upload => upload.relativePath.length)) + 1;

          failedUploads.forEach(upload => {
            console.log(
              `  ${pc.gray('|')} 🔴 ${upload.relativePath.padEnd(pathPadding)} ${pc.gray(
                `| ${upload.sizePretty.padStart(filesizeStrMaxLength)} |`,
              )}`,
            );
          });
        }

        if (this.uploader.skippedUploads.length) {
          console.log(
            '\n',
            APP_PREFIX,
            `🗄️ ${pc.bold(this.uploader.skippedUploads.length)} artifacts uploading 🟡${pc.bold('skipped')}`,
          );
          const skippedUploads = this.uploader.skippedUploads.map(file => ({
            relativePath: file.path.replace(process.cwd(), ''),
            sizePretty: file.size === null ? 'unknown' : prettyBytes(file.size, { round: 0 }).toString(),
          }));
          const pathPadding = Math.max(...skippedUploads.map(upload => upload.relativePath.length)) + 1;
          skippedUploads.forEach(upload => {
            console.log(
              `  ${pc.gray('|')} 🟡 ${upload.relativePath.padEnd(pathPadding)} ${pc.gray(
                `| ${upload.sizePretty.padStart(filesizeStrMaxLength)} |`,
              )}`,
            );
          });
        }

        if (this.uploader.skippedUploads.length || this.uploader.failedUploads.length) {
          const command = `TESTOMATIO=<your_api_key> TESTOMATIO_RUN=${
            this.runId
          } npx @testomatio/reporter upload-artifacts`;
          const numberOfNotUploadedArtifacts = this.uploader.skippedUploads.length + this.uploader.failedUploads.length;
          console.log(
            APP_PREFIX,
            `${numberOfNotUploadedArtifacts} artifacts were not uploaded.
            Run "${pc.magenta(command)}" with valid S3 credentials to upload skipped & failed artifacts`,
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
