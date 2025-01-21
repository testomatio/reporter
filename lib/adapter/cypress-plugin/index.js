"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const constants_js_1 = require("../../constants.js");
const utils_js_1 = require("../../utils/utils.js");
const client_js_1 = __importDefault(require("../../client.js"));
const config_js_1 = require("../../config.js");
const testomatioReporter = on => {
    if (!config_js_1.config.TESTOMATIO) {
        console.log('TESTOMATIO key is empty, ignoring reports');
        return;
    }
    const client = new client_js_1.default({ apiKey: config_js_1.config.TESTOMATIO });
    on('before:run', async () => {
        // TODO: looks like client.env does not exist
        // if (!client.env) {
        //   client.env = `${run.browser.displayName},${run.system.osName}`;
        // }
        await client.createRun();
    });
    on('after:spec', async (_spec, results) => {
        const addSpecTestsPromises = [];
        const videos = [results.video];
        for (const test of results.tests) {
            const lastAttemptIndex = test.attempts.length - 1;
            const latestAttempt = test.attempts[lastAttemptIndex];
            // latestAttempt.duration && latestAttempt.error were available in adapters version up to 13 JFYI
            const time = latestAttempt.duration || latestAttempt.wallClockDuration || test.duration;
            let error = latestAttempt.error;
            let title = test.title.pop();
            const examples = title.match(/\(example (#\d+)\)/);
            let example = null;
            if (examples && examples[1])
                example = { example: examples[1] };
            title = title.replace(/\(example #\d+\)/, '').trim();
            const suiteTitle = test.title.pop();
            const testId = (0, utils_js_1.getTestomatIdFromTestTitle)(title);
            const suiteId = (0, utils_js_1.parseSuite)(suiteTitle);
            if (!error && test.displayError) {
                error = { message: test.displayError };
                // eslint-disable-next-line
                error.inspect = function () {
                    return this.message;
                };
            }
            const formattedError = error
                ? {
                    message: error.message,
                    name: error.name,
                    inspect: error.inspect ||
                        // eslint-disable-next-line
                        function () {
                            return this.message;
                        },
                }
                : undefined;
            const screenshots = Array.isArray(results.screenshots)
                ? results.screenshots
                    .filter(screenshot => screenshot?.path && screenshot?.path.includes(title) && screenshot?.takenAt)
                    .map(screenshot => screenshot.path)
                : [];
            const files = [...videos, ...screenshots];
            let state;
            switch (test.state) {
                case 'passed':
                    state = constants_js_1.STATUS.PASSED;
                    break;
                case 'failed':
                    state = constants_js_1.STATUS.FAILED;
                    break;
                case 'skipped':
                case 'pending':
                default:
                    state = constants_js_1.STATUS.SKIPPED;
            }
            addSpecTestsPromises.push(client.addTestRun(state, {
                title,
                time,
                example,
                error: formattedError,
                files,
                suite_title: suiteTitle,
                test_id: testId,
                suite_id: suiteId,
            }));
        }
        await Promise.all(addSpecTestsPromises);
    });
    on('after:run', async (results) => {
        const status = results.totalFailed ? constants_js_1.STATUS.FAILED : constants_js_1.STATUS.PASSED;
        // @ts-ignore
        await client.updateRunStatus(status);
    });
};
module.exports = testomatioReporter;
