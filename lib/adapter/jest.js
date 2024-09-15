"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JestReporter = void 0;
const picocolors_1 = __importDefault(require("picocolors"));
const client_js_1 = __importDefault(require("../client.js"));
const constants_js_1 = require("../constants.js");
const utils_js_1 = require("../utils/utils.js");
const index_js_1 = require("../services/index.js");
const path_1 = __importDefault(require("path"));
const debug_1 = __importDefault(require("debug"));
const debug = (0, debug_1.default)('@testomatio/reporter:adapter-jest');
class JestReporter {
    constructor(globalConfig, options) {
        this._globalConfig = globalConfig;
        this._options = options;
        this.client = new client_js_1.default({ apiKey: options?.apiKey });
        this.client.createRun();
    }
    onRunStart() {
        // clear tmp dir
        utils_js_1.fileSystem.clearDir(constants_js_1.TESTOMAT_TMP_STORAGE_DIR);
    }
    // start of test file (including beforeAll)
    onTestStart(testFile) {
        debug('Start running test file:', testFile.path);
        index_js_1.services.setContext(testFile.path);
    }
    // start of the test (including beforeEach)
    onTestCaseStart(test, testCase) {
        debug('Start running test:', testCase.fullName);
        index_js_1.services.setContext(testCase.fullName);
    }
    // end of test file! (there is also onTestCaseResult listener)
    onTestResult(test, testResult) {
        if (!this.client)
            return;
        const { testResults } = testResult;
        for (const result of testResults) {
            let error;
            let steps;
            const { status, title, duration, failureMessages } = result;
            if (failureMessages[0]) {
                let errorMessage = failureMessages[0].replace((0, utils_js_1.ansiRegExp)(), '');
                errorMessage = errorMessage.split('\n')[0];
                error = new Error(errorMessage);
                steps = failureMessages[0];
            }
            const testId = (0, utils_js_1.getTestomatIdFromTestTitle)(title);
            // suite titles from most outer to most inner, separated by space
            let fullSuiteTitle = testResult.ancestorTitles?.join(' ');
            // if no suite titles, use file name
            if (!fullSuiteTitle && testResult.testFilePath)
                fullSuiteTitle = path_1.default.basename(testResult.testFilePath);
            const logs = getTestLogs(result);
            const artifacts = index_js_1.services.artifacts.get(result.fullName);
            const keyValues = index_js_1.services.keyValues.get(result.fullName);
            const deducedStatus = status === 'pending' ? 'skipped' : status;
            // In jest if test is not matched with test name pattern it is considered as skipped.
            // So adding a check if it is skipped for real or because of test pattern
            if (!this._globalConfig.testNamePattern || deducedStatus !== 'skipped') {
                this.client.addTestRun(deducedStatus, {
                    test_id: testId,
                    suite_title: fullSuiteTitle,
                    error,
                    steps,
                    title,
                    time: duration,
                    logs,
                    manuallyAttachedArtifacts: artifacts,
                    meta: keyValues,
                });
            }
        }
    }
    onRunComplete(contexts, results) {
        if (!this.client)
            return;
        const { numFailedTests } = results;
        const status = numFailedTests === 0 ? 'passed' : 'failed';
        this.client.updateRunStatus(status);
    }
}
exports.JestReporter = JestReporter;
function getTestLogs(testResult) {
    const suiteLogsArr = index_js_1.services.logger.getLogs(testResult.testFilePath);
    const suiteLogs = suiteLogsArr ? suiteLogsArr.join('\n').trim() : '';
    const testLogsArr = index_js_1.services.logger.getLogs(testResult.fullName);
    const testLogs = testLogsArr ? testLogsArr.join('\n').trim() : '';
    let logs = '';
    if (suiteLogs) {
        logs += `${picocolors_1.default.bold('\t--- Suite ---')}\n${suiteLogs}`;
    }
    if (testLogs) {
        logs += `\n${picocolors_1.default.bold('\t--- Test ---')}\n${testLogs}`;
    }
    return logs;
}
module.exports = JestReporter;

module.exports.JestReporter = JestReporter;
