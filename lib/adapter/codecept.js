const debug = require('debug')('@testomatio/reporter:adapter:codeceptjs');
const chalk = require('chalk');
const TestomatClient = require('../client');
const { STATUS, APP_PREFIX, TESTOMAT_TMP_STORAGE } = require('../constants');
const upload = require('../fileUploader');
const { parseTest: getIdFromTestTitle, fileSystem } = require('../util');

if (!global.codeceptjs) {
  // eslint-disable-next-line global-require, import/no-extraneous-dependencies
  global.codeceptjs = require('codeceptjs');
}

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

  const client = new TestomatClient({ apiKey });

  recorder.startUnlessRunning();

  global.testomatioRunningEnvironment = 'codeceptjs';

  // Listening to events
  event.dispatcher.on(event.all.before, () => {
    // clear tmp dir
    fileSystem.clearDir(TESTOMAT_TMP_STORAGE.mainDir);

    recorder.add('Creating new run', () => client.createRun());
    videos = [];
    traces = [];

    if (!global.testomatioDataStore) global.testomatioDataStore = {};
  });

  event.dispatcher.on(event.test.before, () => {
    recorder.add(() => {
      currentMetaStep = [];
      // output.reset();
      // output.start();
      stepShift = 0;
    });

    global.testomatioDataStore.steps = [];
  });

  event.dispatcher.on(event.test.started, test => {
    testTimeMap[test.id] = Date.now();
    if (global.testomatioDataStore) global.testomatioDataStore.currentlyRunningTestId = getIdFromTestTitle(test.title);
  });

  event.dispatcher.on(event.all.result, async () => {
    debug('waiting for all tests to be reported');
    // all tests were reported and we can upload videos
    await Promise.all(reportTestPromises);

    if (upload.isArtifactsEnabled()) {
      uploadAttachments(client, videos, '🎞️  Uploading', 'video');
      uploadAttachments(client, traces, '📁 Uploading', 'trace');
    }

    const status = failedTests.length === 0 ? STATUS.PASSED : STATUS.FAILED;
    client.updateRunStatus(status);
  });

  event.dispatcher.on(event.test.passed, test => {
    const { id, tags, title } = test;
    if (id && failedTests.includes(id)) {
      failedTests = failedTests.filter(failed => id !== failed);
    }
    const testId = parseTest(tags);
    const testObj = getTestAndMessage(title);
    client.addTestRun(STATUS.PASSED, {
      ...stripExampleFromTitle(title),
      suite_title: test.parent && test.parent.title,
      message: testObj.message,
      time: getDuration(test),
      steps: global.testomatioDataStore.steps.join('\n') || null,
      test_id: testId,
    });
    // output.stop();
  });

  event.dispatcher.on(event.test.failed, (test, err) => {
    error = err;
  });

  event.dispatcher.on(event.hook.failed, (suite, err) => {
    error = err;

    if (!suite) return;
    if (!suite.tests) return;
    for (const test of suite.tests) {
      const { id, tags, title } = test;
      failedTests.push(id || title);
      const testId = parseTest(tags);

      client.addTestRun(STATUS.FAILED, {
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
    if (test.state && test.state !== STATUS.FAILED) return;
    if (test.err) error = test.err;
    const { id, tags, title, artifacts } = test;
    failedTests.push(id || title);
    let testId = parseTest(tags);
    const testObj = getTestAndMessage(title);
    if (error && error.stack && test.steps && test.steps.length) {
      error.stack = test.steps[test.steps.length - 1].line();
    }

    const files = [];
    if (artifacts.screenshot) files.push({ path: artifacts.screenshot, type: 'image/png' });
    // todo: video must be uploaded later....

    const reportTestPromise = client
      .addTestRun(STATUS.FAILED, {
        ...stripExampleFromTitle(title),
        test_id: testId,
        suite_title: test.parent && test.parent.title,
        error,
        message: testObj.message,
        time: getDuration(test),
        files,
        steps: global.testomatioDataStore.steps.join('\n') || null,
      })
      .then(pipes => {
        testId = pipes.filter(p => p.pipe.includes('Testomatio'))[0]?.result?.data?.test_id;

        debug('artifacts', artifacts);

        for (const aid in artifacts) {
          if (aid.startsWith('video')) videos.push({ testId, title, path: artifacts[aid], type: 'video/webm' });
          if (aid.startsWith('trace')) traces.push({ testId, title, path: artifacts[aid], type: 'application/zip' });
        }
      });

    reportTestPromises.push(reportTestPromise);

    // output.stop();
  });

  event.dispatcher.on(event.test.skipped, test => {
    const { id, tags, title } = test;
    if (failedTests.includes(id || title)) return;

    const testId = parseTest(tags);
    const testObj = getTestAndMessage(title);
    client.addTestRun(STATUS.SKIPPED, {
      ...stripExampleFromTitle(title),
      test_id: testId,
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
    if (!step.started) return;
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
        if (!metaSteps[i]) continue;
        if (metaSteps[i].isBDD()) {
          // output.push(repeat(stepShift) + chalk.bold(metaSteps[i].toString()) + metaSteps[i].comment);
          global.testomatioDataStore.steps.push(
            repeat(stepShift) + chalk.bold(metaSteps[i].toString()) + metaSteps[i].comment,
          );
        } else {
          // output.push(repeat(stepShift) + chalk.green.bold(metaSteps[i].toString()));
          global.testomatioDataStore.steps.push(repeat(stepShift) + chalk.green.bold(metaSteps[i].toString()));
        }
      }
    }
    currentMetaStep = metaSteps;
    stepShift = 2 * shift;

    const durationMs = +new Date() - (+stepStart);
    let duration = '';
    if (durationMs) {
      duration = repeat(1) + chalk.grey(`(${durationMs}ms)`);
    }

    if (step.status === STATUS.FAILED) {
      // output.push(repeat(stepShift) + chalk.red(step.toString()) + duration);
      global.testomatioDataStore.steps.push(repeat(stepShift) + chalk.red(step.toString()) + duration);
    } else {
      // output.push(repeat(stepShift) + step.toString() + duration);
      global.testomatioDataStore.steps.push(repeat(stepShift) + step.toString() + duration);
    }
  });

  event.dispatcher.on(event.step.comment, step => {
    // output.push(chalk.cyan.bold(step.toString()));
    global.testomatioDataStore.steps.push(chalk.cyan.bold(step.toString()));
  });
}

async function uploadAttachments(client, attachments, messagePrefix, attachmentType) {
  if (attachments.length > 0) {
    console.log(APP_PREFIX, `Attachments: ${messagePrefix} ${attachments.length} ${attachmentType}/-s ...`);

    const promises = attachments.map(async (attachment) => {
      const { testId, title, path, type } = attachment;
      const file = { path, type, title };
      return client.addTestRun(undefined, {
        ...stripExampleFromTitle(title),
        test_id: testId,
        files: [file],
      });
    });

    await Promise.all(promises);
  }
}

function parseTest(tags) {
  if (tags) {
    for (const tag of tags) {
      if (tag.startsWith('@T')) {
        return tag.substring(2, tag.length);
      }
    }
  }

  return null;
}

function getTestAndMessage(title) {
  const testObj = { message: '' };
  const testArr = title.split(/\s(\|\s\{.*?\})/);
  testObj.title = testArr[0];

  return testObj;
}

function stripExampleFromTitle(title) {
  const res = title.match(DATA_REGEXP);
  if (!res) return { title, example: null };

  const example = JSON.parse(res[1]);
  title = title.replace(DATA_REGEXP, '').trim();

  return { title, example };
}

function repeat(num) {
  return ''.padStart(num, ' ');
}

module.exports = CodeceptReporter;
