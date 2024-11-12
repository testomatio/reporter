"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeceptReporter = CodeceptReporter;
const debug_1 = __importDefault(require("debug"));
const picocolors_1 = __importDefault(require("picocolors"));
const client_js_1 = __importDefault(require("../client.js"));
const constants_js_1 = require("../constants.js");
const utils_js_1 = require("../utils/utils.js");
const index_js_1 = require("../services/index.js");
// eslint-disable-next-line
const codeceptjs_1 = __importDefault(require("codeceptjs"));
const debug = (0, debug_1.default)('@testomatio/reporter:adapter:codeceptjs');
// @ts-ignore
if (!global.codeceptjs) {
    // @ts-ignore
    global.codeceptjs = codeceptjs_1.default;
}
// @ts-ignore
const { event, recorder, codecept } = global.codeceptjs;
let currentMetaStep = [];
let error;
let stepShift = 0;
// const output = new Output({
//   filterFn: stack => !stack.includes('codeceptjs/lib/output'), // output from codeceptjs
// });
let stepStart = new Date();
const MAJOR_VERSION = parseInt(codecept.version().match(/\d/)[0], 10);
const DATA_REGEXP = /[|\s]+?(\{".*\}|\[.*\])/;
if (MAJOR_VERSION < 3) {
    console.log('🔴 This reporter works with CodeceptJS 3+, please update your tests');
}
function CodeceptReporter(config) {
    let failedTests = [];
    let videos = [];
    let traces = [];
    const reportTestPromises = [];
    const testTimeMap = {};
    const { apiKey } = config;
    const getDuration = test => {
        if (testTimeMap[test.id]) {
            return Date.now() - testTimeMap[test.id];
        }
        return 0;
    };
    const client = new client_js_1.default({ apiKey });
    recorder.startUnlessRunning();
    // Listening to events
    event.dispatcher.on(event.all.before, () => {
        // clear tmp dir
        utils_js_1.fileSystem.clearDir(constants_js_1.TESTOMAT_TMP_STORAGE_DIR);
        // recorder.add('Creating new run', () => );
        client.createRun();
        videos = [];
        traces = [];
        if (!global.testomatioDataStore)
            global.testomatioDataStore = {};
    });
    let hookSteps = [];
    let suiteHookRunning = false;
    event.dispatcher.on(event.suite.before, suite => {
        suiteHookRunning = true;
        hookSteps = [];
        global.testomatioDataStore.steps = [];
        index_js_1.services.setContext(suite.fullTitle());
    });
    event.dispatcher.on(event.suite.after, () => {
        index_js_1.services.setContext(null);
    });
    event.dispatcher.on(event.hook.started, () => {
        // global.testomatioDataStore.steps = [];
    });
    event.dispatcher.on(event.hook.passed, () => {
        if (suiteHookRunning) {
            hookSteps.push(...global.testomatioDataStore.steps);
            index_js_1.services.setContext(null);
        }
    });
    event.dispatcher.on(event.hook.failed, () => {
        if (suiteHookRunning) {
            hookSteps.push(...global.testomatioDataStore.steps);
            index_js_1.services.setContext(null);
        }
    });
    event.dispatcher.on(event.test.before, test => {
        suiteHookRunning = false;
        global.testomatioDataStore.steps = [];
        recorder.add(() => {
            currentMetaStep = [];
            // output.reset();
            // output.start();
            stepShift = 0;
        });
        if (!global.testomatioDataStore)
            global.testomatioDataStore = {};
        // reset steps
        global.testomatioDataStore.steps = [];
        index_js_1.services.setContext(test.fullTitle());
    });
    event.dispatcher.on(event.test.started, test => {
        index_js_1.services.setContext(test.fullTitle());
        testTimeMap[test.id] = Date.now();
        // start logging
    });
    event.dispatcher.on(event.all.result, async () => {
        debug('waiting for all tests to be reported');
        // all tests were reported and we can upload videos
        await Promise.all(reportTestPromises);
        await uploadAttachments(client, videos, '🎞️ Uploading', 'video');
        await uploadAttachments(client, traces, '📁 Uploading', 'trace');
        const status = failedTests.length === 0 ? constants_js_1.STATUS.PASSED : constants_js_1.STATUS.FAILED;
        // @ts-ignore
        client.updateRunStatus(status);
    });
    event.dispatcher.on(event.test.passed, test => {
        const { id, tags, title } = test;
        if (id && failedTests.includes(id)) {
            failedTests = failedTests.filter(failed => id !== failed);
        }
        const testObj = getTestAndMessage(title);
        const logs = getTestLogs(test);
        const manuallyAttachedArtifacts = index_js_1.services.artifacts.get(test.fullTitle());
        const keyValues = index_js_1.services.keyValues.get(test.fullTitle());
        index_js_1.services.setContext(null);
        client.addTestRun(constants_js_1.STATUS.PASSED, {
            ...stripExampleFromTitle(title),
            rid: id,
            suite_title: test.parent && test.parent.title,
            message: testObj.message,
            time: getDuration(test),
            steps: global.testomatioDataStore.steps.join('\n') || null,
            test_id: (0, utils_js_1.getTestomatIdFromTestTitle)(`${title} ${tags?.join(' ')}`),
            logs,
            manuallyAttachedArtifacts,
            meta: keyValues,
        });
        // output.stop();
    });
    event.dispatcher.on(event.test.failed, (test, err) => {
        error = err;
    });
    event.dispatcher.on(event.hook.failed, (suite, err) => {
        error = err;
        if (!suite)
            return;
        if (!suite.tests)
            return;
        for (const test of suite.tests) {
            const { id, tags, title } = test;
            failedTests.push(id || title);
            const testId = (0, utils_js_1.getTestomatIdFromTestTitle)(`${title} ${tags?.join(' ')}`);
            client.addTestRun(constants_js_1.STATUS.FAILED, {
                rid: id,
                ...stripExampleFromTitle(title),
                suite_title: suite.title,
                test_id: testId,
                error,
                time: 0,
            });
        }
        // output.stop();
    });
    event.dispatcher.on(event.test.after, test => {
        if (test.state && test.state !== constants_js_1.STATUS.FAILED)
            return;
        if (test.err)
            error = test.err;
        const { id, tags, title, artifacts } = test;
        failedTests.push(id || title);
        const testObj = getTestAndMessage(title);
        const files = [];
        if (artifacts.screenshot)
            files.push({ path: artifacts.screenshot, type: 'image/png' });
        // todo: video must be uploaded later....
        const logs = getTestLogs(test);
        const manuallyAttachedArtifacts = index_js_1.services.artifacts.get(test.fullTitle());
        const keyValues = index_js_1.services.keyValues.get(test.fullTitle());
        index_js_1.services.setContext(null);
        client.addTestRun(constants_js_1.STATUS.FAILED, {
            ...stripExampleFromTitle(title),
            rid: id,
            test_id: (0, utils_js_1.getTestomatIdFromTestTitle)(`${title} ${tags?.join(' ')}`),
            suite_title: test.parent && test.parent.title,
            error,
            message: testObj.message,
            time: getDuration(test),
            files,
            steps: global.testomatioDataStore?.steps?.join('\n') || null,
            logs,
            manuallyAttachedArtifacts,
            meta: keyValues,
        });
        debug('artifacts', artifacts);
        for (const aid in artifacts) {
            if (aid.startsWith('video'))
                videos.push({ rid: id, title, path: artifacts[aid], type: 'video/webm' });
            if (aid.startsWith('trace'))
                traces.push({ rid: id, title, path: artifacts[aid], type: 'application/zip' });
        }
        // output.stop();
    });
    event.dispatcher.on(event.test.skipped, test => {
        const { id, tags, title } = test;
        if (failedTests.includes(id || title))
            return;
        const testObj = getTestAndMessage(title);
        client.addTestRun(constants_js_1.STATUS.SKIPPED, {
            rid: id,
            ...stripExampleFromTitle(title),
            test_id: (0, utils_js_1.getTestomatIdFromTestTitle)(`${title} ${tags?.join(' ')}`),
            suite_title: test.parent && test.parent.title,
            message: testObj.message,
            time: getDuration(test),
        });
        // output.stop();
    });
    event.dispatcher.on(event.step.started, step => {
        stepShift = 0;
        step.started = true;
        stepStart = new Date();
    });
    event.dispatcher.on(event.step.finished, step => {
        if (!step.started)
            return;
        let processingStep = step;
        const metaSteps = [];
        while (processingStep.metaStep) {
            metaSteps.unshift(processingStep.metaStep);
            processingStep = processingStep.metaStep;
        }
        const shift = metaSteps.length;
        for (let i = 0; i < Math.max(currentMetaStep.length, metaSteps.length); i++) {
            if (currentMetaStep[i] !== metaSteps[i]) {
                stepShift = 2 * i;
                // eslint-disable-next-line no-continue
                if (!metaSteps[i])
                    continue;
                if (metaSteps[i].isBDD()) {
                    // output.push(repeat(stepShift) + pc.bold(metaSteps[i].toString()) + metaSteps[i].comment);
                    global.testomatioDataStore?.steps?.push(repeat(stepShift) + picocolors_1.default.bold(metaSteps[i].toString()) + metaSteps[i].comment);
                }
                else {
                    // output.push(repeat(stepShift) + pc.green.bold(metaSteps[i].toString()));
                    global.testomatioDataStore?.steps?.push(repeat(stepShift) + picocolors_1.default.green(picocolors_1.default.bold(metaSteps[i].toString())));
                }
            }
        }
        currentMetaStep = metaSteps;
        stepShift = 2 * shift;
        const durationMs = +new Date() - +stepStart;
        let duration = '';
        if (durationMs) {
            duration = repeat(1) + picocolors_1.default.gray(`(${durationMs}ms)`);
        }
        if (step.status === constants_js_1.STATUS.FAILED) {
            // output.push(repeat(stepShift) + pc.red(step.toString()) + duration);
            global.testomatioDataStore?.steps?.push(repeat(stepShift) + picocolors_1.default.red(step.toString()) + duration);
        }
        else {
            // output.push(repeat(stepShift) + step.toString() + duration);
            global.testomatioDataStore?.steps?.push(repeat(stepShift) + step.toString() + duration);
        }
    });
    event.dispatcher.on(event.step.comment, step => {
        // output.push(pc.cyan.bold(step.toString()));
        global.testomatioDataStore?.steps?.push(picocolors_1.default.cyan(picocolors_1.default.bold(step.toString())));
    });
}
async function uploadAttachments(client, attachments, messagePrefix, attachmentType) {
    if (!attachments?.length)
        return;
    if (client.uploader.isEnabled) {
        console.log(constants_js_1.APP_PREFIX, `Attachments: ${messagePrefix} ${attachments.length} ${attachmentType} ...`);
    }
    const promises = attachments.map(async (attachment) => {
        const { rid, title, path, type } = attachment;
        const file = { path, type, title };
        // we are storing file if upload is disabled
        if (!client.uploader.isEnabled)
            return client.uploader.storeUploadedFile(path, client.runId, rid, false);
        return client.addTestRun(undefined, {
            ...stripExampleFromTitle(title),
            rid,
            files: [file],
        });
    });
    await Promise.all(promises);
}
function getTestAndMessage(title) {
    const testObj = { message: '' };
    const testArr = title.split(/\s(\|\s\{.*?\})/);
    testObj.title = testArr[0];
    return testObj;
}
function stripExampleFromTitle(title) {
    const res = title.match(DATA_REGEXP);
    if (!res)
        return { title, example: null };
    const example = JSON.parse(res[1]);
    title = title.replace(DATA_REGEXP, '').trim();
    return { title, example };
}
function repeat(num) {
    return ''.padStart(num, ' ');
}
// TODO: think about moving to some common utils
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

module.exports.CodeceptReporter = CodeceptReporter;
