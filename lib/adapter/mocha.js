"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// eslint-disable-next-line global-require, import/no-extraneous-dependencies
const mocha_1 = __importDefault(require("mocha"));
const client_js_1 = __importDefault(require("../client.js"));
const constants_js_1 = require("../constants.js");
const utils_js_1 = require("../utils/utils.js");
const config_js_1 = require("../config.js");
const index_js_1 = require("../services/index.js");
const picocolors_1 = __importDefault(require("picocolors"));
const { EVENT_RUN_BEGIN, EVENT_RUN_END, EVENT_TEST_FAIL, EVENT_TEST_PASS, EVENT_TEST_PENDING, EVENT_SUITE_BEGIN, EVENT_SUITE_END, EVENT_TEST_BEGIN, EVENT_TEST_END, } = mocha_1.default.Runner.constants;
function MochaReporter(runner, opts) {
    mocha_1.default.reporters.Base.call(this, runner);
    let passes = 0;
    let failures = 0;
    let skipped = 0;
    // let artifactStore;
    const apiKey = opts?.reporterOptions?.apiKey || config_js_1.config.TESTOMATIO;
    const client = new client_js_1.default({ apiKey });
    runner.on(EVENT_RUN_BEGIN, () => {
        client.createRun();
        utils_js_1.fileSystem.clearDir(constants_js_1.TESTOMAT_TMP_STORAGE_DIR);
    });
    runner.on(EVENT_SUITE_BEGIN, async (suite) => {
        index_js_1.services.setContext(suite.fullTitle());
    });
    runner.on(EVENT_SUITE_END, async () => {
        index_js_1.services.setContext(null);
    });
    runner.on(EVENT_TEST_BEGIN, async (test) => {
        index_js_1.services.setContext(test.fullTitle());
    });
    runner.on(EVENT_TEST_END, async () => {
        index_js_1.services.setContext(null);
    });
    runner.on(EVENT_TEST_PASS, async (test) => {
        passes += 1;
        console.log(picocolors_1.default.bold(picocolors_1.default.green('✔')), test.fullTitle());
        const testId = (0, utils_js_1.getTestomatIdFromTestTitle)(test.title);
        const logs = getTestLogs(test);
        const artifacts = index_js_1.services.artifacts.get(test.fullTitle());
        const keyValues = index_js_1.services.keyValues.get(test.fullTitle());
        client.addTestRun(constants_js_1.STATUS.PASSED, {
            test_id: testId,
            suite_title: getSuiteTitle(test),
            title: getTestName(test),
            code: test.body.toString(),
            file: getFile(test),
            time: test.duration,
            logs,
            manuallyAttachedArtifacts: artifacts,
            meta: keyValues,
        });
    });
    runner.on(EVENT_TEST_PENDING, test => {
        skipped += 1;
        console.log('skip: %s', test.fullTitle());
        const testId = (0, utils_js_1.getTestomatIdFromTestTitle)(test.title);
        client.addTestRun(constants_js_1.STATUS.SKIPPED, {
            title: getTestName(test),
            suite_title: getSuiteTitle(test),
            code: test.body.toString(),
            file: getFile(test),
            test_id: testId,
            time: test.duration,
        });
    });
    runner.on(EVENT_TEST_FAIL, async (test, err) => {
        failures += 1;
        console.log(picocolors_1.default.bold(picocolors_1.default.red('✖')), test.fullTitle(), picocolors_1.default.gray(err.message));
        const testId = (0, utils_js_1.getTestomatIdFromTestTitle)(test.title);
        const logs = getTestLogs(test);
        client.addTestRun(constants_js_1.STATUS.FAILED, {
            error: err,
            suite_title: getSuiteTitle(test),
            file: getFile(test),
            test_id: testId,
            title: getTestName(test),
            code: test.body.toString(),
            time: test.duration,
            logs,
        });
    });
    runner.on(EVENT_RUN_END, () => {
        const status = failures === 0 ? constants_js_1.STATUS.PASSED : constants_js_1.STATUS.FAILED;
        console.log(picocolors_1.default.bold(status), `${passes} passed, ${failures} failed, ${skipped} skipped`);
        // @ts-ignore
        client.updateRunStatus(status);
    });
}
function getTestLogs(test) {
    const suiteLogsArr = index_js_1.services.logger.getLogs(test.parent.fullTitle());
    const suiteLogs = suiteLogsArr ? suiteLogsArr.join('\n').trim() : '';
    const testLogsArr = index_js_1.services.logger.getLogs(test.fullTitle());
    const testLogs = testLogsArr ? testLogsArr.join('\n').trim() : '';
    let logs = '';
    if (suiteLogs) {
        logs += `${picocolors_1.default.bold('\t--- BeforeSuite ---')}\n${suiteLogs}`;
    }
    if (testLogs) {
        logs += `\n${picocolors_1.default.bold('\t--- Test ---')}\n${testLogs}`;
    }
    return logs;
}
function getSuiteTitle(test, pathArr = []) {
    if (test.parent.parent)
        getSuiteTitle(test.parent, pathArr);
    pathArr.push(test.parent.title);
    return pathArr.filter(t => !!t)[0];
}
function getFile(test) {
    return test.parent.file?.replace(process.cwd(), '');
}
function getTestName(test) {
    if (process.env.TESTOMATIO_CREATE === 'fulltitle')
        return test.fullTitle();
    return test.title;
}
// To have this reporter "extend" a built-in reporter uncomment the following line:
// @ts-ignore
mocha_1.default.utils.inherits(MochaReporter, mocha_1.default.reporters.Spec);
module.exports = MochaReporter;
