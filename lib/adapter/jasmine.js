"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JasmineReporter = void 0;
const client_js_1 = __importDefault(require("../client.js"));
const utils_js_1 = require("../utils/utils.js");
const constants_js_1 = require("../constants.js");
class JasmineReporter {
    constructor(options) {
        this.testTimeMap = {};
        this.client = new client_js_1.default({ apiKey: options?.apiKey });
        this.client.createRun();
    }
    getDuration(test) {
        if (this.testTimeMap[test.id]) {
            return Date.now() - this.testTimeMap[test.id];
        }
        return 0;
    }
    specStarted(result) {
        this.testTimeMap[result.id] = Date.now();
    }
    specDone(result) {
        if (!this.client)
            return;
        const title = result.description;
        const { status } = result;
        let errorMessage = '';
        for (let i = 0; i < result.failedExpectations.length; i += 1) {
            errorMessage = `${errorMessage}Failure: ${result.failedExpectations[i].message}\n`;
            errorMessage = `${errorMessage}\n ${result.failedExpectations[i].stack}`;
        }
        console.log(`${title} : ${constants_js_1.STATUS.PASSED}`);
        console.log(errorMessage);
        const testId = (0, utils_js_1.getTestomatIdFromTestTitle)(title);
        errorMessage = errorMessage.replace((0, utils_js_1.ansiRegExp)(), '');
        this.client.addTestRun(status, {
            error: result.failedExpectations[0],
            message: errorMessage,
            test_id: testId,
            title,
            time: this.getDuration(result),
        });
    }
    jasmineDone(suiteInfo, done) {
        if (!this.client)
            return;
        const { overallStatus } = suiteInfo;
        const status = overallStatus === 'failed' ? constants_js_1.STATUS.FAILED : constants_js_1.STATUS.PASSED;
        // @ts-ignore
        this.client.updateRunStatus(status).then(() => done);
    }
}
exports.JasmineReporter = JasmineReporter;
module.exports = JasmineReporter;

module.exports.JasmineReporter = JasmineReporter;
