"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// eslint-disable-next-line global-require, import/no-extraneous-dependencies
const reporter_1 = __importDefault(require("@wdio/reporter"));
const client_js_1 = __importDefault(require("../client.js"));
const utils_js_1 = require("../utils/utils.js");
class WebdriverReporter extends reporter_1.default {
    constructor(options) {
        super(options);
        this.client = new client_js_1.default({ apiKey: options?.apiKey });
        options = Object.assign(options, { stdout: true });
        this._addTestPromises = [];
        this._isSynchronising = false;
    }
    get isSynchronised() {
        return this._isSynchronising === false;
    }
    async onRunnerEnd() {
        this._isSynchronising = true;
        await Promise.all(this._addTestPromises);
        this._isSynchronising = false;
    }
    onTestEnd(test) {
        this._addTestPromises.push(this.addTest(test));
    }
    // wdio-cucumber does not trigger onTestEnd hook, thus, using this one
    /**
     *
     * @returns
     */
    onSuiteEnd(scerario) {
        if (scerario.type === 'scenario') {
            this._addTestPromises.push(this.addBddScenario(scerario));
        }
    }
    async addTest(test) {
        if (!this.client)
            return;
        const { title, _duration: duration, state, error, output } = test;
        const testId = (0, utils_js_1.getTestomatIdFromTestTitle)(title);
        const screenshotEndpoint = '/session/:sessionId/screenshot';
        const screenshotsBuffers = output
            .filter(el => el.endpoint === screenshotEndpoint && el.result && el.result.value)
            .map(el => Buffer.from(el.result.value, 'base64'));
        await this.client.addTestRun(state, {
            error,
            title,
            test_id: testId,
            time: duration,
            filesBuffers: screenshotsBuffers,
        });
    }
    /**
     * @param {import('../../types').WebdriverIOScenario} scenario
     */
    addBddScenario(scenario) {
        if (!this.client)
            return;
        const { title, _duration: duration } = scenario;
        const testId = (0, utils_js_1.getTestomatIdFromTestTitle)(title || scenario.tags.map(tag => tag.name).join(' '));
        let scenarioState = scenario.tests.every(test => test.state === 'passed') ? 'passed' : 'failed';
        if (scenario.tests.every(test => test.state === 'skipped')) {
            scenarioState = 'skipped';
        }
        const errors = scenario.tests
            .filter(test => test.state === 'failed')
            .map(test => test.error?.stack)
            .filter(Boolean);
        const error = errors.join('\n');
        const tags = scenario.tags.map(tag => tag.name);
        return this.client.addTestRun(scenarioState, {
            error: error ? Error(error) : null,
            title,
            test_id: testId,
            time: duration,
            tags,
            file: scenario.file,
            // filesBuffers: screenshotsBuffers,
        });
    }
}
module.exports = WebdriverReporter;
