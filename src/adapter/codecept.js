import createDebugMessages from 'debug';
import pc from 'picocolors';
import TestomatClient from '../client.js';
import { STATUS, APP_PREFIX, TESTOMAT_TMP_STORAGE_DIR } from '../constants.js';
import { getTestomatIdFromTestTitle, fileSystem } from '../utils/utils.js';
import { services } from '../services/index.js';
import codeceptjs from 'codeceptjs';

const debug = createDebugMessages('@testomatio/reporter:adapter:codeceptjs');
// @ts-ignore
if (!global.codeceptjs) {
  // @ts-ignore
  global.codeceptjs = codeceptjs;
}

// @ts-ignore
const { event, recorder, codecept } = global.codeceptjs;

let currentMetaStep = [];
let stepShift = 0;
let isRunningHook = false;

let stepStart = new Date();

const [, MAJOR_VERSION, MINOR_VERSION] = codecept.version().match(/(\d+)\.(\d+)/).map(Number);

const DATA_REGEXP = /[|\s]+?(\{".*\}|\[.*\])/;

if (MAJOR_VERSION < 3) {
  console.log('🔴 This reporter works with CodeceptJS 3+, please update your tests');
}

if (MAJOR_VERSION === 3 && MINOR_VERSION < 7) {
  console.log('🔴 CodeceptJS 3.7+ is supported, please upgrade CodeceptJS or use 1.6 version of `@testomatio/reporter`');
}

function CodeceptReporter(config) {
  let failedTests = [];
  let videos = [];
  let traces = [];
  const reportTestPromises = [];

  const testTimeMap = {};
  const { apiKey } = config;

  const getDuration = test => {
    if (!test.uid) return 0;
    if (testTimeMap[test.uid]) {
      return Date.now() - testTimeMap[test.uid];
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

  event.dispatcher.on(event.suite.before, suite => {
    global.testomatioDataStore.steps = [];

    services.setContext(suite.fullTitle());
  });

  event.dispatcher.on(event.hook.before, () => {
    isRunningHook = true;
  });

  event.dispatcher.on(event.hook.after, () => {
    isRunningHook = false;
  });

  event.dispatcher.on(event.suite.after, () => {
    services.setContext(null);
  });

  event.dispatcher.on(event.test.before, test => {
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
    testTimeMap[test.uid] = Date.now();
  });

  event.dispatcher.on(event.all.result, async (result) => {
    debug('waiting for all tests to be reported');
    // all tests were reported and we can upload videos
    await Promise.all(reportTestPromises);

    await uploadAttachments(client, videos, '🎞️ Uploading', 'video');
    await uploadAttachments(client, traces, '📁 Uploading', 'trace');

    const status = result.hasFailed ? STATUS.FAILED : STATUS.PASSED;
    // @ts-ignore
    client.updateRunStatus(status);
  });

  event.dispatcher.on(event.test.passed, test => {
    const { uid, tags, title } = test;
    if (uid && failedTests.includes(uid)) {
      failedTests = failedTests.filter(failed => uid !== failed);
    }
    const testObj = getTestAndMessage(title);

    const logs = getTestLogs(test);
    const manuallyAttachedArtifacts = services.artifacts.get(test.fullTitle());
    const keyValues = services.keyValues.get(test.fullTitle());
    services.setContext(null);

    client.addTestRun(STATUS.PASSED, {
      ...stripExampleFromTitle(title),
      rid: uid,
      suite_title: test.parent && test.parent.title,
      message: testObj.message,
      time: test.duration,
      steps: test.steps,
      test_id: getTestomatIdFromTestTitle(`${title} ${tags?.join(' ')}`),
      logs,
      manuallyAttachedArtifacts,
      meta: { ...keyValues, ...test.meta },
    });
    // output.stop();
  });

  event.dispatcher.on(event.test.after, test => {
    let error = null;
    if (test.state && test.state !== STATUS.FAILED) return;
    if (test.err) error = test.err;
    const { uid, tags, title, artifacts } = test;
    failedTests.push(uid || title);
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
      rid: uid,
      test_id: getTestomatIdFromTestTitle(`${title} ${tags?.join(' ')}`),
      suite_title: test.parent && test.parent.title,
      error,
      message: testObj.message,
      time: getDuration(test),
      files,
      steps: test.steps,
      logs,
      manuallyAttachedArtifacts,
      meta: { ...keyValues, ...test.meta },
    });

    debug('artifacts', artifacts);

    for (const aid in artifacts) {
      if (aid.startsWith('video')) videos.push({ rid: uid, title, path: artifacts[aid], type: 'video/webm' });
      if (aid.startsWith('trace')) traces.push({ rid: uid, title, path: artifacts[aid], type: 'application/zip' });
    }

    // output.stop();
  });

  event.dispatcher.on(event.test.skipped, test => {
    const { uid, tags, title } = test;
    if (failedTests.includes(uid || title)) return;

    const testObj = getTestAndMessage(title);
    client.addTestRun(STATUS.SKIPPED, {
      rid: uid,
      ...stripExampleFromTitle(title),
      test_id: getTestomatIdFromTestTitle(`${title} ${tags?.join(' ')}`),
      suite_title: test.parent && test.parent.title,
      message: testObj.message,
      time: test.duration,
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
        if (!metaSteps[i]) continue;
        if (metaSteps[i].isBDD()) {
          global.testomatioDataStore?.steps?.push(
            repeat(stepShift) + pc.bold(metaSteps[i].toString()) + metaSteps[i].comment,
          );
        } else {
          global.testomatioDataStore?.steps?.push(repeat(stepShift) + pc.green(pc.bold(metaSteps[i].toString())));
        }
      }
    }
    currentMetaStep = metaSteps;
    stepShift = 2 * shift;

    const durationMs = +new Date() - +stepStart;
    let duration = '';
    if (durationMs) {
      duration = repeat(1) + pc.gray(`(${durationMs}ms)`);
    }

    if (step.status === STATUS.FAILED) {
      // output.push(repeat(stepShift) + pc.red(step.toString()) + duration);
      global.testomatioDataStore?.steps?.push(repeat(stepShift) + pc.red(step.toString()) + duration);
    } else {
      // output.push(repeat(stepShift) + step.toString() + duration);
      global.testomatioDataStore?.steps?.push(repeat(stepShift) + step.toString() + duration);
    }
  });

  event.dispatcher.on(event.step.comment, step => {
    // output.push(pc.cyan.bold(step.toString()));
    global.testomatioDataStore?.steps?.push(pc.cyan(pc.bold(step.toString())));
  });
}

async function uploadAttachments(client, attachments, messagePrefix, attachmentType) {
  if (!attachments?.length) return;

  if (client.uploader.isEnabled) {
    console.log(APP_PREFIX, `Attachments: ${messagePrefix} ${attachments.length} ${attachmentType} ...`);
  }

  const promises = attachments.map(async attachment => {
    const { rid, title, path, type } = attachment;
    const file = { path, type, title };

    // we are storing file if upload is disabled
    if (!client.uploader.isEnabled) return client.uploader.storeUploadedFile(path, client.runId, rid, false);

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
    logs += `${pc.bold('\t--- BeforeSuite ---')}\n${suiteLogs}`;
  }
  if (testLogs) {
    logs += `\n${pc.bold('\t--- Test ---')}\n${testLogs}`;
  }
  return logs;
}

function appendStep(step, shift = 0) {
  // nesting too deep, ignore those steps
  if (shift >= 10) return;

  let newCategory = step.category;
  switch (newCategory) {
    case 'test.step':
      newCategory = 'user';
      break;
    case 'hook':
      newCategory = 'hook';
      break;
    case 'attach':
      return null; // Skip steps with category 'attach'
    default:
      newCategory = 'framework';
  }

  const formattedSteps = [];
  for (const child of step.steps || []) {
    const appendedChild = appendStep(child, shift + 2);
    if (appendedChild) {
      formattedSteps.push(appendedChild);
    }
  }

  const resultStep = {
    category: newCategory,
    title: step.title,
    duration: step.duration,
  };

  if (formattedSteps.length) {
    resultStep.steps = formattedSteps.filter(s => !!s);
  }

  if (step.error !== undefined) {
    resultStep.error = step.error;
  }

  return resultStep;
}

export { CodeceptReporter };
export default CodeceptReporter;
