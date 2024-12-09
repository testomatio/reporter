"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Client = void 0;
const debug_1 = __importDefault(require("debug"));
const callsite_record_1 = __importDefault(require("callsite-record"));
const minimatch_1 = require("minimatch");
const fs_1 = __importDefault(require("fs"));
const picocolors_1 = __importDefault(require("picocolors"));
const crypto_1 = require("crypto");
const constants_js_1 = require("./constants.js");
const index_js_1 = require("./pipe/index.js");
const glob_1 = require("glob");
const path_1 = __importStar(require("path"));
const node_url_1 = require("node:url");
const uploader_js_1 = require("./uploader.js");
const utils_js_1 = require("./utils/utils.js");
const filesize_1 = require("filesize");
const debug = (0, debug_1.default)('@testomatio/reporter:client');
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
        this.runId = (0, crypto_1.randomUUID)(); // will be replaced by real run id
        this.queue = Promise.resolve();
        // @ts-ignore this line will be removed in compiled code, because __dirname is defined in commonjs
        const pathToPackageJSON = path_1.default.join(__dirname, '../package.json');
        try {
            this.version = JSON.parse(fs_1.default.readFileSync(pathToPackageJSON).toString()).version;
            console.log(constants_js_1.APP_PREFIX, `Testomatio Reporter v${this.version}`);
        }
        catch (e) {
            // do nothing
        }
        this.executionList = Promise.resolve();
        this.uploader = new uploader_js_1.S3Uploader();
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
        this.pipes = await (0, index_js_1.pipesFactory)(params || this.paramsForPipesFactory || {}, this.pipeStore);
        const { pipe, pipeOptions } = params;
        // all pipes disabled, skipping
        if (!this.pipes.some(p => p.isEnabled)) {
            return Promise.resolve();
        }
        try {
            const filterPipe = this.pipes.find(p => p.constructor.name.toLowerCase() === `${pipe.toLowerCase()}pipe`);
            if (!filterPipe.isEnabled) {
                // TODO:for the future for the another pipes
                console.warn(constants_js_1.APP_PREFIX, `At the moment processing is available only for the "testomatio" key. Example: "testomatio:tag-name=xxx"`);
                return;
            }
            const results = await Promise.all(this.pipes.map(async (p) => ({ pipe: p.toString(), result: await p.prepareRun(pipeOptions) })));
            const result = results.filter(p => p.pipe.includes('Testomatio'))[0]?.result;
            if (!result || result.length === 0) {
                return;
            }
            debug('Execution tests list', result);
            return result;
        }
        catch (err) {
            console.error(constants_js_1.APP_PREFIX, err);
        }
    }
    /**
     * Used to create a new Test run
     *
     * @returns {Promise<any>} - resolves to Run id which should be used to update / add test
     */
    async createRun(params) {
        if (!this.pipes || !this.pipes.length)
            this.pipes = await (0, index_js_1.pipesFactory)(params || this.paramsForPipesFactory || {}, this.pipeStore);
        debug('Creating run...');
        // all pipes disabled, skipping
        if (!this.pipes?.filter(p => p.isEnabled).length)
            return Promise.resolve();
        this.queue = this.queue
            .then(() => Promise.all(this.pipes.map(p => p.createRun())))
            .catch(err => console.log(constants_js_1.APP_PREFIX, err))
            .then(() => {
            const runId = this.pipeStore?.runId;
            if (runId)
                this.runId = runId;
            (0, utils_js_1.storeRunId)(this.runId);
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
        // all pipes disabled, skipping
        if (!this.pipes?.filter(p => p.isEnabled).length)
            return [];
        if (isTestShouldBeExculedFromReport(testData))
            return [];
        if (status === constants_js_1.STATUS.SKIPPED && process.env.TESTOMATIO_EXCLUDE_SKIPPED) {
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
        const { rid, error = null, time = 0, example = null, files = [], filesBuffers = [], steps, code = null, title, file, suite_title, suite_id, test_id, manuallyAttachedArtifacts, meta, } = testData;
        let { message = '' } = testData;
        let errorFormatted = '';
        if (error) {
            errorFormatted += this.formatError(error) || '';
            message = error?.message;
        }
        // Attach logs
        const fullLogs = this.formatLogs({ error: errorFormatted, steps, logs: testData.logs });
        // add artifacts
        if (manuallyAttachedArtifacts?.length)
            files.push(...manuallyAttachedArtifacts);
        const uploadedFiles = [];
        for (let f of files) {
            if (typeof f === 'object') {
                if (!f.path)
                    continue;
                f = f.path;
            }
            uploadedFiles.push(this.uploader.uploadFileByPath(f, [this.runId, rid, path_1.default.basename(f)]));
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
        this.queue = this.queue.then(() => Promise.all(this.pipes.map(async (pipe) => {
            try {
                const result = await pipe.addTest(data);
                return { pipe: pipe.toString(), result };
            }
            catch (err) {
                console.log(constants_js_1.APP_PREFIX, pipe.toString(), err);
            }
        })));
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
        if (!this.pipes?.filter(p => p.isEnabled).length)
            return Promise.resolve();
        const runParams = { status, parallel: isParallel };
        this.queue = this.queue
            .then(() => Promise.all(this.pipes.map(p => p.finishRun(runParams))))
            .then(() => {
            if (!this.uploader.isEnabled)
                return;
            if (this.uploader.successfulUploads.length) {
                console.log(constants_js_1.APP_PREFIX, `🗄️ ${this.uploader.successfulUploads.length} artifacts ${process.env.TESTOMATIO_PRIVATE_ARTIFACTS ? 'privately' : picocolors_1.default.bold('publicly')} 🟢 uploaded to S3 bucket`);
                const filesizeStrMaxLength = 7;
                if (this.uploader.successfulUploads.length) {
                    debug('\n', constants_js_1.APP_PREFIX, `🗄️ ${this.uploader.successfulUploads.length} artifacts uploaded to S3 bucket`);
                    const uploadedArtifacts = this.uploader.successfulUploads.map(file => ({
                        relativePath: file.path.replace(process.cwd(), ''),
                        link: file.link,
                        sizePretty: (0, filesize_1.filesize)(file.size, { round: 0 }).toString(),
                    }));
                    uploadedArtifacts.forEach(upload => {
                        debug(`🟢 Uploaded artifact`, `${upload.relativePath},`, 'size:', `${upload.sizePretty},`, 'link:', `${upload.link}`);
                    });
                }
                if (this.uploader.failedUploads.length) {
                    console.log(constants_js_1.APP_PREFIX, `🗄️ ${this.uploader.failedUploads.length} artifacts 🔴${picocolors_1.default.bold('failed')} to upload`);
                    const failedUploads = this.uploader.failedUploads.map(file => ({
                        relativePath: file.path.replace(process.cwd(), ''),
                        sizePretty: (0, filesize_1.filesize)(file.size, { round: 0 }).toString(),
                    }));
                    const pathPadding = Math.max(...failedUploads.map(upload => upload.relativePath.length)) + 1;
                    failedUploads.forEach(upload => {
                        console.log(`  ${picocolors_1.default.gray('|')} 🔴 ${upload.relativePath.padEnd(pathPadding)} ${picocolors_1.default.gray(`| ${upload.sizePretty.padStart(filesizeStrMaxLength)} |`)}`);
                    });
                }
                if (this.uploader.skippedUploads.length) {
                    console.log('\n', constants_js_1.APP_PREFIX, `🗄️ ${picocolors_1.default.bold(this.uploader.skippedUploads.length)} artifacts uploading 🟡${picocolors_1.default.bold('skipped')} (due to large size)`);
                    const skippedUploads = this.uploader.skippedUploads.map(file => ({
                        relativePath: file.path.replace(process.cwd(), ''),
                        sizePretty: file.size === null ? 'unknown' : (0, filesize_1.filesize)(file.size, { round: 0 }).toString(),
                    }));
                    const pathPadding = Math.max(...skippedUploads.map(upload => upload.relativePath.length)) + 1;
                    skippedUploads.forEach(upload => {
                        console.log(`  ${picocolors_1.default.gray('|')} 🟡 ${upload.relativePath.padEnd(pathPadding)} ${picocolors_1.default.gray(`| ${upload.sizePretty.padStart(filesizeStrMaxLength)} |`)}`);
                    });
                }
                if (this.uploader.skippedUploads.length || this.uploader.failedUploads.length) {
                    const command = `TESTOMATIO=<your_api_key> TESTOMATIO_RUN=${this.runId} npx @testomatio/reporter upload-artifacts`;
                    console.log(constants_js_1.APP_PREFIX, `Run "${picocolors_1.default.magenta(command)}" with valid S3 credentials to upload skipped & failed artifacts`);
                }
            }
        })
            .catch(err => console.log(constants_js_1.APP_PREFIX, err));
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
                .map(step => (0, utils_js_1.formatStep)(step))
                .flat()
                .join('\n');
        }
        let testLogs = '';
        if (steps)
            testLogs += `${picocolors_1.default.bold(picocolors_1.default.blue('################[ Steps ]################'))}\n${steps}\n\n`;
        if (logs)
            testLogs += `${picocolors_1.default.bold(picocolors_1.default.gray('################[ Logs ]################'))}\n${logs}\n\n`;
        if (error)
            testLogs += `${picocolors_1.default.bold(picocolors_1.default.red('################[ Failure ]################'))}\n${error}`;
        return testLogs;
    }
    formatError(error, message) {
        if (!message)
            message = error.message;
        if (error.inspect)
            message = error.inspect() || '';
        let stack = '';
        if (error.name)
            stack += `${picocolors_1.default.red(error.name)}`;
        if (error.operator)
            stack += ` (${picocolors_1.default.red(error.operator)})`;
        // add new line if something was added to stack
        if (stack)
            stack += ': ';
        stack += `${message}\n`;
        if (error.diff) {
            // diff for vitest
            stack += error.diff;
            stack += '\n\n';
        }
        else if (error.actual && error.expected && error.actual !== error.expected) {
            // diffs for mocha, cypress, codeceptjs style
            stack += `\n\n${picocolors_1.default.bold(picocolors_1.default.green('+ expected'))} ${picocolors_1.default.bold(picocolors_1.default.red('- actual'))}`;
            stack += `\n${picocolors_1.default.green(`+ ${error.expected.toString().split('\n').join('\n+ ')}`)}`;
            stack += `\n${picocolors_1.default.red(`- ${error.actual.toString().split('\n').join('\n- ')}`)}`;
            stack += '\n\n';
        }
        const customFilter = process.env.TESTOMATIO_STACK_IGNORE;
        try {
            let hasFrame = false;
            const record = (0, callsite_record_1.default)({
                forError: error,
                isCallsiteFrame: frame => {
                    if (customFilter && (0, minimatch_1.minimatch)(frame.fileName, customFilter))
                        return false;
                    if (hasFrame)
                        return false;
                    if (isNotInternalFrame(frame))
                        hasFrame = true;
                    return hasFrame;
                },
            });
            // @ts-ignore
            if (record && !record.filename.startsWith('http')) {
                stack += record.renderSync({ stackFilter: isNotInternalFrame });
            }
            return stack;
        }
        catch (e) {
            console.log(e);
        }
    }
}
exports.Client = Client;
function isNotInternalFrame(frame) {
    return (frame.getFileName() &&
        frame.getFileName().includes(path_1.sep) &&
        !frame.getFileName().includes('node_modules') &&
        !frame.getFileName().includes('internal'));
}
/**
 *
 * @param {TestData} testData
 * @returns boolean
 */
function isTestShouldBeExculedFromReport(testData) {
    // const fileName = path.basename(test.location?.file || '');
    const globExcludeFilesPattern = process.env.TESTOMATIO_EXCLUDE_FILES_FROM_REPORT_GLOB_PATTERN;
    if (!globExcludeFilesPattern)
        return false;
    if (!testData.file) {
        debug('No "file" property found for test ', testData.title);
        return false;
    }
    const excludeParretnsList = globExcludeFilesPattern.split(';');
    // as scanning files is time consuming operation, just save the result in variable to avoid multiple scans
    if (!listOfTestFilesToExcludeFromReport) {
        // list of files with relative paths
        listOfTestFilesToExcludeFromReport = glob_1.glob.sync(excludeParretnsList, { ignore: '**/node_modules/**' });
        debug('Tests from next files will not be reported:', listOfTestFilesToExcludeFromReport);
    }
    const testFileRelativePath = path_1.default.relative(process.cwd(), testData.file);
    // no files found matching the exclusion pattern
    if (!listOfTestFilesToExcludeFromReport.length)
        return false;
    if (listOfTestFilesToExcludeFromReport.includes(testFileRelativePath)) {
        debug(`Excluding test '${testData.title}' <${testFileRelativePath}> from reporting`);
        return true;
    }
    return false;
}
module.exports = Client;

module.exports.Client = Client;
