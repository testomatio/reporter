"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CucumberReporter = void 0;
const cucumber_1 = require("@cucumber/cucumber");
const picocolors_1 = __importDefault(require("picocolors"));
const fs_1 = __importDefault(require("fs"));
const constants_js_1 = require("../../constants.js");
const client_js_1 = __importDefault(require("../../client.js"));
const utils_js_1 = require("../../utils/utils.js");
const config_js_1 = require("../../config.js");
const index_js_1 = require("../../services/index.js");
const { GherkinDocumentParser, PickleParser } = cucumber_1.formatterHelpers;
const { getGherkinScenarioLocationMap, getGherkinStepMap } = GherkinDocumentParser;
const { getPickleStepMap } = PickleParser;
function getTestId(scenario) {
    if (scenario) {
        for (const tag of scenario.tags) {
            const testId = (0, utils_js_1.getTestomatIdFromTestTitle)(tag.name);
            if (testId)
                return testId;
        }
    }
    return null;
}
class CucumberReporter extends cucumber_1.Formatter {
    constructor(options) {
        super(options);
        options.eventBroadcaster.on('envelope', this.parseEnvelope.bind(this));
        this.failures = [];
        this.cases = [];
        this.client = new client_js_1.default({ apiKey: options.apiKey || config_js_1.config.TESTOMATIO });
        this.client.createRun();
        this.status = constants_js_1.STATUS.PASSED;
    }
    parseEnvelope(envelope) {
        if (envelope.testRunStarted) {
            utils_js_1.fileSystem.clearDir(constants_js_1.TESTOMAT_TMP_STORAGE_DIR);
        }
        if (envelope.testCaseStarted && this.client) {
            this.onTestCaseStarted(envelope.testCaseStarted);
        }
        if (envelope.testCaseFinished)
            this.onTestCaseFinished(envelope.testCaseFinished);
        if (envelope.testRunFinished)
            this.onTestRunFinished(envelope);
    }
    onTestCaseStarted(testCaseStarted) {
        const testCaseAttempt = this.eventDataCollector.getTestCaseAttempt(testCaseStarted.id);
        if (!global.testomatioDataStore)
            global.testomatioDataStore = {};
        const testTitle = testCaseAttempt.pickle.name + testCaseAttempt.pickle.uri;
        index_js_1.services.setContext(testTitle);
    }
    onTestCaseFinished(testCaseFinished) {
        const testCaseAttempt = this.eventDataCollector.getTestCaseAttempt(testCaseFinished.testCaseStartedId);
        let example;
        let status = constants_js_1.STATUS.PASSED;
        let color = 'green';
        let message;
        this.cases.push(testCaseAttempt);
        if (testCaseAttempt.worstTestStepResult) {
            if (testCaseAttempt.worstTestStepResult.status === 'SKIPPED') {
                status = constants_js_1.STATUS.SKIPPED;
            }
            // if (testCaseAttempt.worstTestStepResult.status === 'UNDEFINED') {
            //   status = STATUS.SKIPPED;
            //   message = 'Undefined steps. Implement missing steps and rerun this scenario';
            // }
            if (testCaseAttempt.worstTestStepResult.status === 'FAILED') {
                message = testCaseAttempt?.worstTestStepResult?.message;
                status = constants_js_1.STATUS.FAILED;
            }
            color = getStatusColor(testCaseAttempt.worstTestStepResult.status);
            if (status !== constants_js_1.STATUS.PASSED)
                this.failures.push(testCaseAttempt);
        }
        if (testCaseAttempt.pickle.astNodeIds.length > 1) {
            example = getExample(testCaseAttempt);
            // @ts-ignore
            testCaseAttempt.example = example;
        }
        const scenario = testCaseAttempt.pickle.name;
        // this may broke something (it is supposed to work, but I am sure it did not)
        // const testId = testCaseAttempt.pickle.id;
        const testId = getTestId(testCaseAttempt.pickle);
        let exampleString = '';
        if (example)
            exampleString = ` ${example.join(' | ')}`;
        let cliMessage = `${picocolors_1.default.bold(scenario)}${exampleString}: ${picocolors_1.default[color](picocolors_1.default.bold(status.toUpperCase()))} `;
        if (message)
            cliMessage += picocolors_1.default.gray(message.split('\n')[0]);
        console.log(cliMessage);
        if (status !== constants_js_1.STATUS.PASSED && status !== constants_js_1.STATUS.SKIPPED) {
            this.status = constants_js_1.STATUS.FAILED;
        }
        const time = Object.values(testCaseAttempt.stepResults)
            .map(t => t.duration)
            .reduce((sum, duration) => sum + duration.seconds * 1000 + duration.nanos / 1000000, 0);
        if (!this.client)
            return;
        const testTitle = testCaseAttempt.pickle.name + testCaseAttempt.pickle.uri;
        const logs = index_js_1.services.logger.getLogs(testTitle).join('\n');
        const artifacts = index_js_1.services.artifacts.get(testTitle);
        const keyValues = index_js_1.services.keyValues.get(testTitle);
        this.client.addTestRun(status, {
            // error: testCaseAttempt.worstTestStepResult.message,
            message,
            steps: getSteps(testCaseAttempt)
                .map(s => s.toString())
                .join('\n')
                .trim(),
            example: { ...example },
            logs,
            manuallyAttachedArtifacts: artifacts,
            meta: keyValues,
            title: scenario,
            test_id: testId,
            time,
        });
        index_js_1.services.setContext(null);
    }
    onTestRunFinished(envelope) {
        if (this.failures.length > 0) {
            console.log(picocolors_1.default.bold('\nSUMMARY:\n\n'));
            this.failures.forEach((tc, i) => {
                let message = `  ${i + 1}) ${tc.pickle.name}\n`;
                const steps = getSteps(tc);
                steps.forEach(s => {
                    message += `     ${s.toString()}\n`;
                });
                console.log(message);
                if (tc?.worstTestStepResult?.message) {
                    console.log(picocolors_1.default.red(tc?.worstTestStepResult?.message));
                }
                console.log();
            });
        }
        const { testRunFinished } = envelope;
        const bgColor = testRunFinished.success ? 'bgGreen' : 'bgRed';
        const prefixSummary = `${picocolors_1.default.bold(testRunFinished.success ? ' SUCCESS ' : ' FALIURE ')}`;
        console.log();
        console.log(picocolors_1.default[bgColor](` ${prefixSummary} | Total Scenarios: ${picocolors_1.default.bold(this.cases.length)} `));
        if (!this.client)
            return;
        // @ts-ignore
        this.client.updateRunStatus(testRunFinished.success ? constants_js_1.STATUS.PASSED : constants_js_1.STATUS.FAILED);
    }
}
exports.CucumberReporter = CucumberReporter;
function getSteps(tc) {
    const stepIds = Object.keys(tc.stepResults);
    const pickleSteps = getPickleStepMap(tc.pickle);
    return stepIds
        .map(stepId => {
        const ts = tc.testCase.testSteps.find(t => t.id === stepId);
        if (!ts)
            return;
        if (!ts.pickleStepId)
            return;
        const result = tc.stepResults[stepId];
        const pickleStep = pickleSteps[ts.pickleStepId];
        const sourceStepId = pickleStep.astNodeIds[0];
        const step = {
            text: pickleStep.text,
            duration: result.duration,
            status: result.status,
        };
        const color = getStatusColor(result.status);
        if (sourceStepId && getGherkinStepMap(tc.gherkinDocument)[sourceStepId]) {
            step.keyword = getGherkinStepMap(tc.gherkinDocument)[sourceStepId].keyword;
        }
        step.toString = function toString() {
            const duration = step.duration.seconds * 1000 + step.duration.nanos / 1000000;
            const durationString = ` ${picocolors_1.default.gray(`(${Number(duration).toFixed(2)}ms)`)}`;
            const stepString = `${picocolors_1.default.bold(this.keyword)}${this.text}`.trim();
            if (color === 'red')
                return picocolors_1.default.red(stepString) + durationString;
            if (color === 'yellow')
                return picocolors_1.default.yellow(stepString) + durationString;
            return stepString + durationString;
        };
        return step;
    })
        .filter(s => !!s);
}
function getStatusColor(status) {
    if (status === 'UNDEFINED')
        return 'yellow';
    if (status === 'SKIPPED')
        return 'yellow';
    if (status === 'FAILED')
        return 'red';
    return 'green';
}
function getExample(testCaseAttempt) {
    const nodesMap = getGherkinScenarioLocationMap(testCaseAttempt.gherkinDocument);
    const exampleNodeId = testCaseAttempt.pickle.astNodeIds[1];
    if (!nodesMap[exampleNodeId])
        return;
    const featureDoc = fs_1.default.readFileSync(testCaseAttempt.gherkinDocument.uri).toString();
    const { line } = nodesMap[exampleNodeId];
    const example = featureDoc.split('\n')[line - 1];
    if (example) {
        return example
            .trim()
            .split('|')
            .filter(r => !!r)
            .map(r => r.trim());
    }
}
module.exports = CucumberReporter;

module.exports.CucumberReporter = CucumberReporter;
