import createDebugMessages from 'debug';
import fs from 'fs';
import pc from 'picocolors';
import { APP_PREFIX, STATUS } from './constants.js';
import { pipesFactory } from './pipe/index.js';
import { glob } from 'glob';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { S3Uploader } from './uploader.js';
import { readLatestRunId, storeRunId, validateSuiteId, transformEnvVarToBoolean } from './utils/utils.js';
import { filesize as prettyBytes } from 'filesize';
import { formatLogs, formatError, stripColors } from './utils/log-formatter.js';

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
  async createRun(params = {}) {
    if (!this.pipes || !this.pipes.length)
      this.pipes = await pipesFactory(params || this.paramsForPipesFactory || {}, this.pipeStore);
    debug('Creating run...');
    // all pipes disabled, skipping
    if (!this.pipes?.filter(p => p.isEnabled).length) return Promise.resolve();

    this.queue = this.queue
      .then(() => Promise.all(this.pipes.map(p => p.createRun(params))))
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
    const { rid, error = null, steps: originalSteps, title, suite_title } = testData;
    let steps = originalSteps;

    const uploadedFiles = [];
    const stackArtifactsEnabled = transformEnvVarToBoolean(process.env.TESTOMATIO_STACK_ARTIFACTS);

    const {
      time = 0,
      example = null,
      files = [],
      filesBuffers = [],
      code = null,
      file,
      suite_id,
      test_id,
      timestamp,
      links,
      manuallyAttachedArtifacts,
      overwrite,
      tags,
    } = testData;
    let { message = '', meta = {} } = testData;

    meta = Object.entries(meta)
      .filter(([, value]) => value !== null && value !== undefined)
      .reduce((acc, [key, value]) => {
        if (key) acc[key] = value;
        return acc;
      }, {});

    const testContext = suite_title ? `${suite_title} ${title}` : title;

    let errorFormatted = '';
    if (error) {
      errorFormatted += formatError(error) || '';
      message = error?.message;
    }

    let fullLogs = formatLogs({ error: errorFormatted, steps, logs: testData.logs });

    if (stackArtifactsEnabled && fullLogs?.trim()?.length > 0) {
      uploadedFiles.push(
        this.uploader.uploadFileAsBuffer(Buffer.from(stripColors(fullLogs), 'utf8'), [
          this.runId,
          rid,
          `logs_${+new Date()}.log`,
        ]),
      );
      fullLogs = '';
      steps = null;
    }

    if (!this.pipes || !this.pipes.length)
      this.pipes = await pipesFactory(this.paramsForPipesFactory || {}, this.pipeStore);

    if (!this.pipes?.filter(p => p.isEnabled).length) {
      if (uploadedFiles.length > 0) {
        await Promise.all(uploadedFiles);
      }
      return [];
    }

    if (isTestShouldBeExcludedFromReport(testData)) return [];

    if (status === STATUS.SKIPPED && process.env.TESTOMATIO_EXCLUDE_SKIPPED) {
      debug('Skipping test from report', testData?.title);
      return [];
    }

    if (manuallyAttachedArtifacts?.length) files.push(...manuallyAttachedArtifacts);

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
      links,
      overwrite,
      tags,
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
   * @returns {Promise<any>} - A Promise that resolves when finishes the run.
   */
  async updateRunStatus(status) {
    this.pipes ||= await pipesFactory(this.paramsForPipesFactory || {}, this.pipeStore);
    this.runId ||= readLatestRunId();

    debug('Updating run status...');
    // all pipes disabled, skipping
    if (!this.pipes?.filter(p => p.isEnabled).length) return Promise.resolve();

    const runParams = { status };

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
            sizePretty: file.size == null ? 'unknown' : prettyBytes(file.size, { round: 0 }).toString(),
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
            sizePretty: file.size == null ? 'unknown' : prettyBytes(file.size, { round: 0 }).toString(),
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
}

/**
 *
 * @param {TestData} testData
 * @returns boolean
 */
function isTestShouldBeExcludedFromReport(testData) {
  // const fileName = path.basename(test.location?.file || '');
  const globExcludeFilesPattern = process.env.TESTOMATIO_EXCLUDE_FILES_FROM_REPORT_GLOB_PATTERN;
  if (!globExcludeFilesPattern) return false;

  if (!testData.file) {
    debug('No "file" property found for test ', testData.title);
    return false;
  }

  const excludePatternsList = globExcludeFilesPattern.split(';');

  // as scanning files is time consuming operation, just save the result in variable to avoid multiple scans
  if (!listOfTestFilesToExcludeFromReport) {
    // list of files with relative paths
    listOfTestFilesToExcludeFromReport = glob.sync(excludePatternsList, { ignore: '**/node_modules/**' });
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
