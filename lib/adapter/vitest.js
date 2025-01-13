"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VitestReporter = void 0;
const picocolors_1 = __importDefault(require("picocolors"));
const client_js_1 = require("../client.js");
const constants_js_1 = require("../constants.js");
const utils_js_1 = require("../utils/utils.js");
const debug_1 = __importDefault(require("debug"));
const debug = (0, debug_1.default)('@testomatio/reporter:adapter-jest');
/**
 * @typedef {import('../../types/types.js').VitestTest} VitestTest
 * @typedef {import('../../types/types.js').VitestTestFile} VitestTestFile
 * @typedef {import('../../types/types.js').VitestSuite} VitestSuite
 * @typedef {import('../../types/types.js').VitestTestLogs} VitestTestLogs
 * @typedef {import('../../types/vitest.types.js').ErrorWithDiff} ErrorWithDiff
 * @typedef {typeof import('../constants.js').STATUS} STATUS
 * @typedef {import('../../types/types.js').TestData} TestData
 */
class VitestReporter {
    constructor(config = {}) {
        this.client = new client_js_1.Client({ apiKey: config?.apiKey });
        /**
         * @type {(TestData & {status: string})[]} tests
         */
        this.tests = [];
    }
    // on run start
    onInit() {
        this.client.createRun();
    }
    /**
     * @param {VitestTestFile[] | undefined} files // array with results;
     * @param {unknown[] | undefined} errors // errors does not contain errors from tests; probably its testrunner errors
     */
    async onFinished(files, errors) {
        if (!files || !files.length)
            console.info('No tests executed');
        files.forEach(file => {
            // task could be test or suite
            file.tasks.forEach(taskOrSuite => {
                if (taskOrSuite.type === 'test') {
                    const test = taskOrSuite;
                    this.tests.push(this.#getDataFromTest(test));
                }
                else if (taskOrSuite.type === 'suite') {
                    const suite = taskOrSuite;
                    this.#processTasksOfSuite(suite);
                }
                else {
                    throw new Error('Unprocessed case. Unknown task type');
                }
            });
        });
        debug(this.tests.length, 'tests collected');
        // send tests to Testomat.io
        for (const test of this.tests) {
            await this.client.addTestRun(test.status, test);
        }
        console.log('finished');
        if (errors.length)
            console.error('Vitest adapter errors:', errors);
        await this.client.updateRunStatus(getRunStatusFromResults(files));
    }
    /* non-used listeners
    onUserConsoleLog(log) {}
    onPathsCollected(paths) {} // paths array to files with tests
    onCollected(files) {} // files array with tests (but without results)
    onTaskUpdate(packs) {} // some updates come here on afterAll block execution
    onTestRemoved(trigger) {}
    onWatcherStart(files, errors) {}
    onWatcherRerun(files, trigger) {}
    onServerRestart(reason) {}
    onProcessTimeout() {}
    */
    /**
     * Recursively gets all tasks from suite and pushes them to "tests" array
     *
     * @param {VitestSuite} suite
     */
    #processTasksOfSuite(suite) {
        suite.tasks.forEach(taskOrSuite => {
            if (taskOrSuite.type === 'test') {
                const test = taskOrSuite;
                this.tests.push(this.#getDataFromTest(test));
            }
            else if (taskOrSuite.type === 'suite') {
                const theSuite = taskOrSuite;
                this.#processTasksOfSuite(theSuite);
            }
            else {
                throw new Error('Unprocessed case. Unknown task type');
            }
        });
    }
    /**
     * Processes task and returns test data ready to be sent to Testomat.io
     *
     * @param {VitestTest} test
     *
     * @returns {TestData & {status: string}}
     */
    #getDataFromTest(test) {
        return {
            error: test.result?.errors ? test.result.errors[0] : undefined,
            file: test.file.name,
            logs: test.logs ? transformLogsToString(test.logs) : '',
            meta: test.meta,
            status: getTestStatus(test),
            suite_title: test.suite.name || test.file?.name,
            test_id: (0, utils_js_1.getTestomatIdFromTestTitle)(test.name),
            time: test.result?.duration || 0,
            title: test.name,
            // testomatio functions (artifacts, logs, steps, meta) are not supported
        };
    }
}
exports.VitestReporter = VitestReporter;
/**
 * Returns run status based on test results
 *
 * @param {VitestTestFile[]} files
 * @returns {'passed' | 'failed' | 'finished'}
 */
function getRunStatusFromResults(files) {
    /**
     * @type {'passed' | 'failed' | 'finished'}
     */
    let status = 'finished'; // default status (if no failed or passed tests)
    files.forEach(file => {
        // search for failed tests
        file.tasks.forEach(taskOrSuite => {
            if (taskOrSuite.result?.state === 'fail') {
                status = 'failed'; // set status to failed if any test failed
            }
        });
        // if there are no failed tests > search for passed tests
        if (status !== 'failed') {
            file.tasks.forEach(taskOrSuite => {
                if (taskOrSuite.result?.state === 'pass') {
                    status = 'passed'; // set status to passed if any test passed (and there are no failed tests)
                }
            });
        }
    });
    return status;
}
/**
 * Returns test status in Testomat.io format
 *
 * @param {VitestTest} test
 * @returns 'passed' | 'failed' | 'skipped'
 */
function getTestStatus(test) {
    if (test.result?.state === 'fail')
        return constants_js_1.STATUS.FAILED;
    if (test.result?.state === 'pass')
        return constants_js_1.STATUS.PASSED;
    if (!test.result && test.mode === 'skip')
        return constants_js_1.STATUS.SKIPPED;
    console.error(picocolors_1.default.red('Unprocessed case for defining test status. Contact dev team. Test:'), test);
}
/**
 * @param {VitestTestLogs[]} logs
 * @returns string
 */
function transformLogsToString(logs) {
    if (!logs)
        return '';
    let logsStr = '';
    logs.forEach(log => {
        if (log.type === 'stdout')
            logsStr += `${log.content}\n`;
        if (log.type === 'stderr')
            logsStr += `${picocolors_1.default.red(log.content)}\n`;
    });
    return logsStr;
}
module.exports = VitestReporter;

module.exports.VitestReporter = VitestReporter;
