/* eslint-disable no-param-reassign */
const { event, recorder, output } = codeceptjs;
const chalk = require('chalk');
const TestomatClient = require('../client');
const { FAILED } = require('../constants');
const TRConstants = require('../constants');

let stepEvents = '';
let currentMetaStep = [];
let stepShift = 0;

const parseTest = tags => {
  for (const tag of tags) {
    if (tag.startsWith('@T')) {
      return tag.substring(2, tag.length);
    }
  }

  return null;
};

const getTestAndMessage = title => {
  const testObj = { message: '' };
  const testArr = title.split(/\s(\|\s\{.*?\})/);
  testObj.title = testArr[0];

  return testObj;
};

module.exports = (config) => {
  let failedTests = [];
  const testTimeMap = {};
  const { apiKey } = config;

  const getDuration = test => {
    if (testTimeMap[test.id]) {
      return Date.now() - testTimeMap[test.id];
    }

    return 0;
  };

  if (apiKey === '' || apiKey === undefined) {
    throw new Error('Testomat API key cannot be empty');
  }
  const client = new TestomatClient({ apiKey });

  recorder.startUnlessRunning();

  // Listening to events
  event.dispatcher.on(event.all.before, () => {
    recorder.add('Creating new run', () => client.createRun());
  });

  event.dispatcher.on(event.test.before, () => {
    stepEvents = '';
    currentMetaStep = [];
  });

  event.dispatcher.on(event.test.started, (test) => {
    testTimeMap[test.id] = Date.now();
  });

  event.dispatcher.on(event.all.result, () => {
    const status = failedTests.length === 0 ? TRConstants.PASSED : TRConstants.FAILED;
    client.updateRunStatus(status);
  });

  event.dispatcher.on(event.test.passed, (test) => {
    const { id, tags, title } = test;
    if (id && failedTests.includes(id)) {
      failedTests = failedTests.filter(failed => id !== failed);
    }
    const testId = parseTest(tags);
    const testObj = getTestAndMessage(title);
    client.addTestRun(testId, TRConstants.PASSED, {
      ...stripExampleFromTitle(title),
      message: testObj.message,
      time: getDuration(test),
      steps: stepEvents,
    });
  });

  event.dispatcher.on(event.test.after, (test) => {
    if (test.state === FAILED) {
      const {
        id, tags, title, err, artifacts,
      } = test;
      failedTests.push(id || title);
      const testId = parseTest(tags);
      const testObj = getTestAndMessage(title);
      client.addTestRun(testId, TRConstants.FAILED, {
        ...stripExampleFromTitle(title),
        error: err,
        message: testObj.message,
        time: getDuration(test),
        files: artifacts.screenshot ? [artifacts.screenshot] : [],
        steps: stepEvents,
      });
    }
  });

  event.dispatcher.on(event.test.skipped, (test) => {
    const { tags, title } = test;
    const testId = parseTest(tags);
    const testObj = getTestAndMessage(title);
    client.addTestRun(testId, TRConstants.SKIPPED, {
      ...stripExampleFromTitle(title),
      message: testObj.message,
      time: getDuration(test),
    });
  });

  event.dispatcher.on(event.step.finished, (step) => {
    stepShift = 0;
  });

  event.dispatcher.on(event.step.finished, (step) => {
    const printMetaStep = (metaStep) => {
      if (!metaStep) return currentMetaStep.shift();
      if (currentMetaStep.indexOf(metaStep.toString()) >= 0) return; // step is the same
      if (metaStep.metaStep) {
        printMetaStep(metaStep.metaStep);
      }
      currentMetaStep.unshift(metaStep.toString());
      stepEvents = `${chalk.white(stepEvents + metaStep.toString())}\n`;
    };
    printMetaStep(step.metaStep);
    if (step.metaStep) {
      stepShift += 2;
    }
    if (step.status === TRConstants.FAILED) {
      stepEvents = `${stepEvents + ' '.repeat(stepShift) + (chalk.red(`  ${step.toString()}`))}\n`;
    } else {
      stepEvents = `${stepEvents + ' '.repeat(stepShift) + (chalk.green(`  ${step.toString()}`))}\n`;
    }
  });

  event.dispatcher.on(event.step.comment, (step) => {
    stepEvents = `${stepEvents + (chalk.cyan(`  ${step.toString()}`))}\n`;
  });
};

const DATA_REGEXP = /[|\s]+?(\{\".*\}|\[.*\])/;

function stripExampleFromTitle(title) {
  const res = title.match(DATA_REGEXP);
  if (!res) return { title, example: null };

  const example = JSON.parse(res[1]);
  title = title.replace(DATA_REGEXP, '').trim();

  return { title, example };
}
