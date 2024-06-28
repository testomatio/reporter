const debug = require('debug')('@testomatio/reporter:adapter:codeceptjs');
const chalk = require('chalk');
const TestomatClient = require('../client');
const { STATUS, APP_PREFIX, TESTOMAT_TMP_STORAGE_DIR } = require('../constants');
const upload = require('../fileUploader');
const { getTestomatIdFromTestTitle, fileSystem } = require('../utils/utils');
const { services } = require('../services');

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

  // Listening to events
  event.dispatcher.on(event.all.before, () => {
    // clear tmp dir
    fileSystem.clearDir(TESTOMAT_TMP_STORAGE_DIR);

    // recorder.add('Creating new run', () => );
    client.createRun();
    videos = [];
    traces = [];

    if (!global.testomatioDataStore) global.testomatioDataStore = {};
  });

  let hookSteps = [];
  let suiteHookRunning = false;

  event.dispatcher.on(event.suite.before, suite => {
    suiteHookRunning = true;
    hookSteps = [];
    global.testomatioDataStore.steps = [];

    services.setContext(suite.fullTitle());
  });

  event.dispatcher.on(event.suite.after, () => {
    services.setContext(null);
  });

  event.dispatcher.on(event.hook.started, () => {
    // global.testomatioDataStore.steps = [];
  });

  event.dispatcher.on(event.hook.passed, () => {
    if (suiteHookRunning) {
      hookSteps.push(...global.testomatioDataStore.steps);
      services.setContext(null);
    }
  });

  event.dispatcher.on(event.hook.failed, () => {
    if (suiteHookRunning) {
      hookSteps.push(...global.testomatioDataStore.steps);
      services.setContext(null);
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

    if (!global.testomatioDataStore) global.testomatioDataStore = {};
    // reset steps
    global.testomatioDataStore.steps = [];

    services.setContext(test.fullTitle());
  });

  event.dispatcher.on(event.test.started, test => {
    services.setContext(test.fullTitle());

    testTimeMap[test.id] = Date.now();
    // start logging
  });

  event.dispatcher.on(event.all.result, async () => {
    debug('waiting for all tests to be reported');
    // all tests were reported and we can upload videos
    await Promise.all(reportTestPromises);

    if (upload.isArtifactsEnabled()) {
      await uploadAttachments(client, videos, '🎞️ Uploading', 'video');
      await uploadAttachments(client, traces, '📁 Uploading', 'trace');
    }

    const status = failedTests.length === 0 ? STATUS.PASSED : STATUS.FAILED;
    client.updateRunStatus(status);
  });

  event.dispatcher.on(event.test.passed, test => {
    const { id, tags, title } = test;
    if (id && failedTests.includes(id)) {
      failedTests = failedTests.filter(failed => id !== failed);
    }
    const testObj = getTestAndMessage(title);

    const logs = getTestLogs(test);
    const manuallyAttachedArtifacts = services.artifacts.get(test.fullTitle());
    const keyValues = services.keyValues.get(test.fullTitle());
    services.setContext(null);

    client.addTestRun(STATUS.PASSED, {
      ...stripExampleFromTitle(title),
      rid: id,
      suite_title: test.parent && test.parent.title,
      message: testObj.message,
      time: getDuration(test),
      steps: global.testomatioDataStore.steps.join('\n') || null,
      test_id: getTestomatIdFromTestTitle(`${title} ${tags?.join(' ')}`),
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

    if (!suite) return;
    if (!suite.tests) return;
    for (const test of suite.tests) {
      const { id, tags, title } = test;
      failedTests.push(id || title);
      const testId = getTestomatIdFromTestTitle(`${title} ${tags?.join(' ')}`);

      client.addTestRun(STATUS.FAILED, {
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
    if (test.state && test.state !== STATUS.FAILED) return;
    if (test.err) error = test.err;
    const { id, tags, title, artifacts } = test;
    failedTests.push(id || title);
    const testObj = getTestAndMessage(title);

    const files = [];
    if (artifacts.screenshot) files.push({ path: artifacts.screenshot, type: 'image/png' });
    // todo: video must be uploaded later....

    const logs = getTestLogs(test);
    const manuallyAttachedArtifacts = services.artifacts.get(test.fullTitle());
    const keyValues = services.keyValues.get(test.fullTitle());
    services.setContext(null);

    client.addTestRun(STATUS.FAILED, {
        ...stripExampleFromTitle(title),
        rid: id,
        test_id: getTestomatIdFromTestTitle(`${title} ${tags?.join(' ')}`),
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
      if (aid.startsWith('video')) videos.push({ rid: id, title, path: artifacts[aid], type: 'video/webm' });
      if (aid.startsWith('trace')) traces.push({ rid: id, title, path: artifacts[aid], type: 'application/zip' });
    }

    // output.stop();
  });

  event.dispatcher.on(event.test.skipped, test => {
    const { id, tags, title } = test;
    if (failedTests.includes(id || title)) return;

    const testObj = getTestAndMessage(title);
    client.addTestRun(STATUS.SKIPPED, {
      rid: id,
      ...stripExampleFromTitle(title),
      test_id: getTestomatIdFromTestTitle(`${title} ${tags?.join(' ')}`),
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
          global.testomatioDataStore?.steps?.push(
            repeat(stepShift) + chalk.bold(metaSteps[i].toString()) + metaSteps[i].comment,
          );
        } else {
          // output.push(repeat(stepShift) + chalk.green.bold(metaSteps[i].toString()));
          global.testomatioDataStore?.steps?.push(repeat(stepShift) + chalk.green.bold(metaSteps[i].toString()));
        }
      }
    }
    currentMetaStep = metaSteps;
    stepShift = 2 * shift;

    const durationMs = +new Date() - +stepStart;
    let duration = '';
    if (durationMs) {
      duration = repeat(1) + chalk.grey(`(${durationMs}ms)`);
    }

    if (step.status === STATUS.FAILED) {
      // output.push(repeat(stepShift) + chalk.red(step.toString()) + duration);
      global.testomatioDataStore?.steps?.push(repeat(stepShift) + chalk.red(step.toString()) + duration);
    } else {
      // output.push(repeat(stepShift) + step.toString() + duration);
      global.testomatioDataStore?.steps?.push(repeat(stepShift) + step.toString() + duration);
    }
  });

  event.dispatcher.on(event.step.comment, step => {
    // output.push(chalk.cyan.bold(step.toString()));
    global.testomatioDataStore?.steps?.push(chalk.cyan.bold(step.toString()));
  });
}

async function uploadAttachments(client, attachments, messagePrefix, attachmentType) {
  if (!attachments?.length) return;

  console.log(APP_PREFIX, `Attachments: ${messagePrefix} ${attachments.length} ${attachmentType} ...`);

  const promises = attachments.map(async attachment => {
    const { rid, title, path, type } = attachment;
    const file = { path, type, title };
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
  if (!res) return { title, example: null };

  const example = JSON.parse(res[1]);
  title = title.replace(DATA_REGEXP, '').trim();

  return { title, example };
}

function repeat(num) {
  return ''.padStart(num, ' ');
}

// TODO: think about moving to some common utils
function getTestLogs(test) {
  const suiteLogsArr = services.logger.getLogs(test.parent.fullTitle());
  const suiteLogs = suiteLogsArr ? suiteLogsArr.join('\n').trim() : '';
  const testLogsArr = services.logger.getLogs(test.fullTitle());
  const testLogs = testLogsArr ? testLogsArr.join('\n').trim() : '';

  let logs = '';
  if (suiteLogs) {
    logs += `${chalk.bold('\t--- BeforeSuite ---')}\n${suiteLogs}`;
  }
  if (testLogs) {
    logs += `\n${chalk.bold('\t--- Test ---')}\n${testLogs}`;
  }
  return logs;
}

module.exports = CodeceptReporter;
