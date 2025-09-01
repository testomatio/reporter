import { Formatter, formatterHelpers } from '@cucumber/cucumber';

import pc from 'picocolors';
import fs from 'fs';
import { STATUS, TESTOMAT_TMP_STORAGE_DIR } from '../../constants.js';
import TestomatClient from '../../client.js';
import { getTestomatIdFromTestTitle, fileSystem } from '../../utils/utils.js';
import { config } from '../../config.js';
import { services } from '../../services/index.js';

const { GherkinDocumentParser, PickleParser } = formatterHelpers;
const { getGherkinScenarioLocationMap, getGherkinStepMap } = GherkinDocumentParser;
const { getPickleStepMap } = PickleParser;

function getTestId(scenario) {
  if (scenario) {
    for (const tag of scenario.tags) {
      const testId = getTestomatIdFromTestTitle(tag.name);
      if (testId) return testId;
    }
  }

  return null;
}

class CucumberReporter extends Formatter {
  constructor(options) {
    super(options);
    options.eventBroadcaster.on('envelope', this.parseEnvelope.bind(this));
    this.failures = [];
    this.cases = [];

    this.client = new TestomatClient({ apiKey: options.apiKey || config.TESTOMATIO });
    this.client.createRun();
    this.status = STATUS.PASSED;
  }

  parseEnvelope(envelope) {
    if (envelope.testRunStarted) {
      fileSystem.clearDir(TESTOMAT_TMP_STORAGE_DIR);
    }
    if (envelope.testCaseStarted && this.client) {
      this.onTestCaseStarted(envelope.testCaseStarted);
    }
    if (envelope.testCaseFinished) this.onTestCaseFinished(envelope.testCaseFinished);
    if (envelope.testRunFinished) this.onTestRunFinished(envelope);
  }

  onTestCaseStarted(testCaseStarted) {
    const testCaseAttempt = this.eventDataCollector.getTestCaseAttempt(testCaseStarted.id);
    if (!global.testomatioDataStore) global.testomatioDataStore = {};

    const testTitle = testCaseAttempt.pickle.name + testCaseAttempt.pickle.uri;
    services.setContext(testTitle);
  }

  onTestCaseFinished(testCaseFinished) {
    const testCaseAttempt = this.eventDataCollector.getTestCaseAttempt(testCaseFinished.testCaseStartedId);

    let example;

    let status = STATUS.PASSED;
    let color = 'green';
    let message;

    this.cases.push(testCaseAttempt);

    if (testCaseAttempt.worstTestStepResult) {
      if (testCaseAttempt.worstTestStepResult.status === 'SKIPPED') {
        status = STATUS.SKIPPED;
      }
      // if (testCaseAttempt.worstTestStepResult.status === 'UNDEFINED') {
      //   status = STATUS.SKIPPED;
      //   message = 'Undefined steps. Implement missing steps and rerun this scenario';
      // }
      if (testCaseAttempt.worstTestStepResult.status === 'FAILED') {
        message = testCaseAttempt?.worstTestStepResult?.message;
        status = STATUS.FAILED;
      }
      color = getStatusColor(testCaseAttempt.worstTestStepResult.status);
      if (status !== STATUS.PASSED) this.failures.push(testCaseAttempt);
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
    if (example) exampleString = ` ${example.join(' | ')}`;
    let cliMessage = `${pc.bold(scenario)}${exampleString}: ${pc[color](pc.bold(status.toUpperCase()))} `;

    if (message) cliMessage += pc.gray(message.split('\n')[0]);
    console.log(cliMessage);

    if (status !== STATUS.PASSED && status !== STATUS.SKIPPED) {
      this.status = STATUS.FAILED;
    }

    const time = Object.values(testCaseAttempt.stepResults)
      .map(t => t.duration)
      .reduce((sum, duration) => sum + duration.seconds * 1000 + duration.nanos / 1000000, 0);

    if (!this.client) return;

    const testTitle = testCaseAttempt.pickle.name + testCaseAttempt.pickle.uri;
    const logs = services.logger.getLogs(testTitle).join('\n');
    const artifacts = services.artifacts.get(testTitle);
    const keyValues = services.keyValues.get(testTitle);
    const links = services.links.get(testTitle);

    this.client.addTestRun(status, {
      // error: testCaseAttempt.worstTestStepResult.message,
      message,
      steps: getSteps(testCaseAttempt)
        .map(s => s.toString())
        .join('\n')
        .trim(),
      example: { ...example },
      logs,
      links,
      manuallyAttachedArtifacts: artifacts,
      meta: keyValues,
      title: scenario,
      test_id: testId,
      time,
    });

    services.setContext(null);
  }

  onTestRunFinished(envelope) {
    if (this.failures.length > 0) {
      console.log(pc.bold('\nSUMMARY:\n\n'));

      this.failures.forEach((tc, i) => {
        let message = `  ${i + 1}) ${tc.pickle.name}\n`;

        const steps = getSteps(tc);

        steps.forEach(s => {
          message += `     ${s.toString()}\n`;
        });

        console.log(message);
        if (tc?.worstTestStepResult?.message) {
          console.log(pc.red(tc?.worstTestStepResult?.message));
        }
        console.log();
      });
    }

    const { testRunFinished } = envelope;

    const bgColor = testRunFinished.success ? 'bgGreen' : 'bgRed';
    const prefixSummary = `${pc.bold(testRunFinished.success ? ' SUCCESS ' : ' FALIURE ')}`;
    console.log();
    console.log(pc[bgColor](` ${prefixSummary} | Total Scenarios: ${pc.bold(this.cases.length)} `));

    if (!this.client) return;

    // @ts-ignore
    this.client.updateRunStatus(testRunFinished.success ? STATUS.PASSED : STATUS.FAILED);
  }
}

function getSteps(tc) {
  const stepIds = Object.keys(tc.stepResults);
  const pickleSteps = getPickleStepMap(tc.pickle);
  return stepIds
    .map(stepId => {
      const ts = tc.testCase.testSteps.find(t => t.id === stepId);
      if (!ts) return;
      if (!ts.pickleStepId) return;
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
        const durationString = ` ${pc.gray(`(${Number(duration).toFixed(2)}ms)`)}`;
        const stepString = `${pc.bold(this.keyword)}${this.text}`.trim();
        if (color === 'red') return pc.red(stepString) + durationString;
        if (color === 'yellow') return pc.yellow(stepString) + durationString;
        return stepString + durationString;
      };
      return step;
    })
    .filter(s => !!s);
}

function getStatusColor(status) {
  if (status === 'UNDEFINED') return 'yellow';
  if (status === 'SKIPPED') return 'yellow';
  if (status === 'FAILED') return 'red';
  return 'green';
}

function getExample(testCaseAttempt) {
  const nodesMap = getGherkinScenarioLocationMap(testCaseAttempt.gherkinDocument);
  const exampleNodeId = testCaseAttempt.pickle.astNodeIds[1];
  if (!nodesMap[exampleNodeId]) return;
  const featureDoc = fs.readFileSync(testCaseAttempt.gherkinDocument.uri).toString();
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

export { CucumberReporter };
export default CucumberReporter;
