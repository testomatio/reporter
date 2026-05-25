import createDebugMessages from 'debug';
import path from 'path';
import pc from 'picocolors';
import TestomatClient from '../client.js';
import { STATUS, APP_PREFIX, TESTOMAT_TMP_STORAGE_DIR, SCREENSHOTS_ON_STEPS } from '../constants.js';
import { getTestomatIdFromTestTitle, truncate, fileSystem } from '../utils/utils.js';
import { services } from '../services/index.js';
import { dataStorage } from '../data-storage.js';
import { formatStep, addStatusToStep, addArtifactsToStep, addArtifactPathToStep } from './utils/step-formatter.js';
import codeceptjs from 'codeceptjs';
import { log } from '../utils/log.js';

const debug = createDebugMessages('@testomatio/reporter:adapter:codeceptjs');
// @ts-ignore
if (!global.codeceptjs) {
  // @ts-ignore
  global.codeceptjs = codeceptjs;
}

// @ts-ignore
const { event, recorder, codecept, output } = global.codeceptjs;

const [, MAJOR_VERSION, MINOR_VERSION] = codecept
  .version()
  .match(/(\d+)\.(\d+)/)
  .map(Number);

// Constants for hook execution order
const HOOK_EXECUTION_ORDER = {
  PRE_TEST: ['BeforeSuiteHook', 'BeforeHook'],
  POST_TEST: ['AfterHook', 'AfterSuiteHook'],
};

// codeceptjs workers are self-contained
dataStorage.isFileStorage = false;

const DATA_REGEXP = /[|\s]+?(\{".*\}|\[.*\])/;

if (MAJOR_VERSION < 3) {
  console.log('🔴 This reporter works with CodeceptJS 3+, please update your tests');
}

if (MAJOR_VERSION === 3 && MINOR_VERSION < 7) {
  console.log(
    '🔴 CodeceptJS 3.7+ is supported, please upgrade CodeceptJS or use 1.6 version of `@testomatio/reporter`',
  );
}

function CodeceptReporter(config) {
  const failedTests = [];
  let videos = [];
  let traces = [];
  const reportTestPromises = [];
  let isRunFinalized = false;

  const testTimeMap = {};
  const clientConfig = buildCodeceptClientConfig(config);
  const client = new TestomatClient(clientConfig);

  // Store original output methods for fallback
  const originalOutput = {
    debug: output.debug,
    log: output.log,
    step: output.step,
    say: output.say,
  };

  output.debug = function (msg) {
    originalOutput.debug(msg);
    dataStorage.putData('log', repeat(this?.stepShift || 0) + pc.cyan(msg.toString()));
  };

  output.say = function (message, color = 'cyan') {
    originalOutput.say(message, color);
    const sayMsg = repeat(this?.stepShift || 0) + `  ${pc.bold(pc[color](message))}`;
    dataStorage.putData('log', sayMsg);
  };

  output.log = function (msg) {
    originalOutput.log(msg);
    dataStorage.putData('log', repeat(this?.stepShift || 0) + pc.gray(msg));
  };
  output.stepShift = 0;

  recorder.startUnlessRunning();

  const hookSteps = new Map();
  let currentHook = null;

  const finalizeRun = async origin => {
    if (isRunFinalized) return;
    isRunFinalized = true;

    debug(`finalizing run from ${origin}`);
    debug('waiting for all tests to be reported');

    await Promise.allSettled(reportTestPromises);
    await uploadAttachments(client, videos, '🎞️ Uploading', 'video');
    await uploadAttachments(client, traces, '📁 Uploading', 'trace');
    await client.updateRunStatus('finished');
  };

  event.dispatcher.on(event.workers.before, () => {
    recorder.add('Creating new run', async () => {
      await client.createRun();
      process.env.TESTOMATIO_RUN = client.runId;
      process.env.TESTOMATIO_PROCEED = 'true';
      debug('Run ID:', client.runId);
    });
  });

  event.dispatcher.on(event.workers.after, () => {
    recorder.add('Finishing run', async () => {
      await finalizeRun('workers.after');
    });
  });

  // Listening to events
  event.dispatcher.on(event.all.before, () => {
    // clear tmp dir
    // fileSystem.clearDir(TESTOMAT_TMP_STORAGE_DIR);

    // recorder.add('Creating new run', () => );
    recorder.add('Creating new run', () => {
      return client.createRun();
    });
    videos = [];
    traces = [];
    isRunFinalized = false;
    reportTestPromises.length = 0;

    if (!global.testomatioDataStore) global.testomatioDataStore = {};
  });

  // Hook event listeners
  event.dispatcher.on(event.hook.started, hook => {
    output.stepShift = 2;
    currentHook = hook.name;
    let title = hook.hookName;
    if (hook.suite) title += ' ' + hook.suite.fullTitle();
    if (hook.test) title += ' ' + hook.test.fullTitle();
    if (hook.ctx.currentTest) title += ' ' + hook.ctx.currentTest.fullTitle();

    services.setContext(title);
    hookSteps.set(hook.name, []);
  });

  event.dispatcher.on(event.hook.finished, () => {
    currentHook = null;
    output.stepShift = 2;
    services.setContext(null);
  });

  // mark as failed all tests inside the failed hook
  event.dispatcher.on(event.hook.failed, hook => {
    if (hook.name !== 'BeforeSuiteHook' && hook.name !== 'BeforeHook') return;
    const suite = hook.runnable.parent;

    if (!suite) return;

    const error = hook?.ctx?.currentTest?.err;

    for (const test of suite.tests) {
      const reportTestPromise = client.addTestRun('failed', {
        ...stripExampleFromTitle(test.title),
        rid: test.uid,
        test_id: getTestomatIdFromTestTitle(test.title),
        suite_title: stripTagsFromTitle(suite.title),
        error,
        time: hook?.runnable?.duration,
      });
      reportTestPromises.push(reportTestPromise);
    }
  });

  event.dispatcher.on(event.suite.before, suite => {
    dataStorage.setContext(suite.fullTitle());
  });

  event.dispatcher.on(event.suite.after, () => {
    services.setContext(null);
  });

  event.dispatcher.on(event.test.before, test => {
    initializeTestDataStore();
    services.setContext(test.fullTitle());
  });

  event.dispatcher.on(event.test.started, test => {
    services.setContext(test.fullTitle());
    testTimeMap[test.uid] = Date.now();
  });

  event.dispatcher.on(event.all.after, () => {
    recorder.add('Finishing run', async () => {
      await finalizeRun('all.after');
    });
  });

  event.dispatcher.on(event.test.after, test => {
    const { uid, tags, title, artifacts } = test.simplify();
    const error = test.err || null;
    failedTests.push(uid || title);
    const testObj = getTestAndMessage(title);
    const files = buildArtifactFiles(artifacts);
    const logs = getTestLogs(test);
    const manuallyAttachedArtifacts = services.artifacts.get(test.fullTitle());
    const keyValues = services.keyValues.get(test.fullTitle());
    const links = services.links.get(test.fullTitle());
    const screenshotOnFailPath = artifacts.screenshot || null;

    // Build step hierarchy with screenshot from screenshotOnFail
    const stepHierarchy = buildUnifiedStepHierarchy(
      test.steps, 
      hookSteps, 
      screenshotOnFailPath
    );

    services.setContext(null);

    const reportTestPromise = client.addTestRun(test.state, {
      ...stripExampleFromTitle(title),
      rid: uid,
      test_id: getTestomatIdFromTestTitle(`${title} ${tags?.join(' ')}`),
      suite_title: test.parent && stripTagsFromTitle(stripExampleFromTitle(test.parent.title).title),
      error,
      message: testObj.message,
      time: test.duration,
      files,
      steps: stepHierarchy, // Array of step objects per API schema
      logs,
      links,
      manuallyAttachedArtifacts,
      meta: { ...keyValues, ...test.meta },
    });
    reportTestPromises.push(reportTestPromise);

    processArtifactsForUpload(artifacts, uid, title, videos, traces);
  });

  event.dispatcher.on(event.step.started, step => {
    const stepText = `${repeat(output.stepShift)} ${step.toCliStyled ? step.toCliStyled() : step.toString()}`;
    dataStorage.putData('log', stepText);
  });

  event.dispatcher.on(event.step.finished, step => {
    processMetaStepsForDisplay(step);
    captureHookStep(step, currentHook, hookSteps);
  });
}

async function uploadAttachments(client, attachments, messagePrefix, attachmentType) {
  if (!attachments?.length) return;

  if (client.uploader.isEnabled) {
    log.info(`Attachments: ${messagePrefix} ${attachments.length} ${attachmentType} ...`);
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

  try {
    const example = JSON.parse(res[1]);
    title = title.replace(DATA_REGEXP, '').trim();
    return { title, example };
  } catch (e) {
    // If JSON parsing fails, return title without example
    debug('Failed to parse example JSON:', res[1], e.message);
    return { title: title.replace(DATA_REGEXP, '').trim(), example: null };
  }
}

function stripTagsFromTitle(title) {
  // Remove @tags from the end of titles (e.g., "Hooks Test Suite @hooks" -> "Hooks Test Suite")
  return title.replace(/\s+@[\w-]+\s*$/, '').trim();
}

function repeat(num) {
  return ''.padStart(num, ' ');
}

// Helper functions for cleaner event handling
function initializeTestDataStore() {
  if (!global.testomatioDataStore) global.testomatioDataStore = {};
  global.testomatioDataStore.steps = [];
}

function buildArtifactFiles(artifacts) {
  const files = [];
  if (artifacts.screenshot) {
    files.push({ path: artifacts.screenshot, type: 'image/png' });
  }
  return files;
}

function processArtifactsForUpload(artifacts, uid, title, videos, traces) {
  for (const aid in artifacts) {
    if (aid.startsWith('video')) {
      videos.push({ rid: uid, title, path: artifacts[aid], type: 'video/webm' });
    }
    if (aid.startsWith('trace')) {
      traces.push({ rid: uid, title, path: artifacts[aid], type: 'application/zip' });
    }
  }
}

function processMetaStepsForDisplay(step) {
  const metaSteps = [];
  let processingStep = step;

  while (processingStep.metaStep) {
    metaSteps.unshift(processingStep.metaStep);
    processingStep = processingStep.metaStep;
  }
}

function captureHookStep(step, currentHook, hookSteps) {
  if (!currentHook) return;

  const startTime = step.startTime;
  const endTime = step.endTime;

  const hookStepsArray = hookSteps.get(currentHook) || [];
  hookStepsArray.push({
    name: step.name,
    actor: step.actor,
    args: step.args,
    status: step.status,
    startTime,
    endTime,
    helperMethod: step.helperMethod,
  });
  hookSteps.set(currentHook, hookStepsArray);
}

// TODO: think about moving to some common utils
function getTestLogs(test) {
  // Contexts for each log section
  const suiteTitle = test.parent.fullTitle();
  const testTitle = test.fullTitle();
  const beforeSuiteLogsArr = services.logger.getLogs(`BeforeSuite ${suiteTitle}`);
  const beforeLogsArr = services.logger.getLogs(`Before ${testTitle}`);
  const testLogsArr = services.logger.getLogs(testTitle);
  const afterLogsArr = services.logger.getLogs(`After ${testTitle}`);
  const afterSuiteLogsArr = services.logger.getLogs(`AfterSuite ${suiteTitle}`);

  const beforeSuiteLogs = beforeSuiteLogsArr ? beforeSuiteLogsArr.join('\n').trim() : '';
  const beforeLogs = beforeLogsArr ? beforeLogsArr.join('\n').trim() : '';
  const testLogs = testLogsArr ? testLogsArr.join('\n').trim() : '';
  const afterLogs = afterLogsArr ? afterLogsArr.join('\n').trim() : '';
  const afterSuiteLogs = afterSuiteLogsArr ? afterSuiteLogsArr.join('\n').trim() : '';

  let logs = '';
  if (beforeSuiteLogs) {
    logs += `${pc.bold('--- BeforeSuite ---')}\n${beforeSuiteLogs}`;
  }
  if (beforeLogs) {
    logs += `\n${pc.bold('--- Before ---')}\n${beforeLogs}`;
  }
  if (testLogs) {
    logs += `\n${pc.bold('--- Test ---')}\n${testLogs}`;
  }
  if (afterLogs) {
    logs += `\n${pc.bold('--- After ---')}\n${afterLogs}`;
  }
  if (afterSuiteLogs) {
    logs += `\n${pc.bold('--- AfterSuite ---')}\n${afterSuiteLogs}`;
  }
  return logs;
}

// Build step hierarchy using CodeceptJS built-in methods
function buildUnifiedStepHierarchy(steps, hookSteps, screenshotOnFailPath = null) {
  const hierarchy = [];

  // Add pre-test hooks
  addHooksToHierarchy(hierarchy, hookSteps, HOOK_EXECUTION_ORDER.PRE_TEST);

  // Process test steps if they exist
  if (steps && steps.length > 0) {
    processTestSteps(steps, hierarchy, screenshotOnFailPath);
  }

  // Add post-test hooks
  addHooksToHierarchy(hierarchy, hookSteps, HOOK_EXECUTION_ORDER.POST_TEST);

  return hierarchy;
}

function addHooksToHierarchy(hierarchy, hookSteps, hookNames) {
  for (const hookName of hookNames) {
    if (hookSteps.has(hookName)) {
      const hookSection = createHookSection(hookName, hookSteps.get(hookName));
      if (hookSection) hierarchy.push(hookSection);
    }
  }
}

function processTestSteps(steps, hierarchy, screenshotOnFailPath = null) {
  const sectionMap = new Map();
  let screenshotAttached = false;

  for (const step of steps) {
    let stepScreenshotPath = null;
    if (screenshotOnFailPath && !screenshotAttached && step.status === 'failed') {
      stepScreenshotPath = screenshotOnFailPath;
      screenshotAttached = true;
    }

    const formattedStep = formatCodeceptStep(step, stepScreenshotPath);
    if (!formattedStep) continue;

    if (step.metaStep) {
      // Step belongs to a section (meta step)
      const sectionKey = step.metaStep;
      let sectionStep = sectionMap.get(sectionKey);

      if (!sectionStep) {
        sectionStep = createSectionStep(step.metaStep);
        sectionMap.set(sectionKey, sectionStep);
        hierarchy.push(sectionStep);
      }

      sectionStep.steps.push(formattedStep);
      sectionStep.duration += formattedStep.duration || 0;
    } else {
      // Regular step
      hierarchy.push(formattedStep);
    }
  }
}

function createSectionStep(metaStep) {
  return {
    category: 'user',
    title: metaStep.toString(), // Use built-in toString method
    duration: metaStep.duration || 0, // Use built-in duration
    steps: [],
  };
}

function createHookSection(hookName, steps) {
  if (!steps || steps.length === 0) return null;

  const hookSection = {
    category: 'hook',
    title: formatHookName(hookName),
    duration: 0,
    steps: [],
  };

  for (const step of steps) {
    const formattedStep = formatHookStep(step);
    if (formattedStep) {
      hookSection.steps.push(formattedStep);
      hookSection.duration += formattedStep.duration || 0;
    }
  }

  return hookSection.steps.length > 0 ? hookSection : null;
}

function formatHookName(hookName) {
  return hookName.replace(/Hook$/, '');
}

function getCodeceptStepCategory(origin = 'test') {
  if (origin === 'hook') return 'hook';
  return 'user';
}

// Format CodeceptJS step using its built-in methods
function formatCodeceptStep(step, screenshotOnFailPath = null) {
  if (!step) return null;

  const category = getCodeceptStepCategory('test');
  const title = truncate(String(step));
  const duration = step.duration || 0;

  const formattedStep = formatStep({
    category,
    title,
    duration,
  });

  // Add status
  addStatusToStep(formattedStep, step.status, step.err);

  // Add error if step failed
  if (step.status === 'failed' && step.err) {
    formattedStep.error = {
      message: truncate(String(step.err.message || 'Step failed'), 250),
      stack: truncate(String(step.err.stack || ''), 250),
    };
  }

  // Add artifacts
  if (step.artifacts && SCREENSHOTS_ON_STEPS) {
    addArtifactsToStep(formattedStep, step.artifacts);
  }

  // Add screenshot from screenshotOnFail plugin
  if (screenshotOnFailPath && SCREENSHOTS_ON_STEPS) {
    addArtifactPathToStep(formattedStep, screenshotOnFailPath);
  }

  // Add log if present
  if (step.log) {
    formattedStep.log = truncate(String(step.log), 250);
  }

  return formattedStep;
}

function formatHookStep(step) {
  if (!step) return null;

  // For hook steps, construct title from available properties
  let title = step.name;
  if (step.actor && step.name) {
    title = `${step.actor} ${step.name}`;
    if (step.args && step.args.length > 0) {
      const argsStr = step.args.map(arg => truncate(JSON.stringify(arg), 250)).join(', ');
      title += ` ${argsStr}`;
    }
  }
  title = truncate(title);

  const formattedStep = formatStep({
    category: getCodeceptStepCategory('hook'),
    title,
    duration: step.duration || 0,
  });

  addStatusToStep(formattedStep, step.status, step.err);

  if (step.status === 'failed' && step.err) {
    formattedStep.error = {
      message: truncate(String(step.err.message || 'Hook failed'), 250),
      stack: truncate(String(step.err.stack || ''), 250),
    };
  }

  // Add artifacts
  if (step.artifacts && SCREENSHOTS_ON_STEPS) {
    addArtifactsToStep(formattedStep, step.artifacts);
  }

  // Add log if present
  if (step.log) {
    formattedStep.log = truncate(String(step.log), 250);
  }

  return formattedStep;
}

export { CodeceptReporter };
export default CodeceptReporter;

function buildCodeceptClientConfig(config = {}) {
  const outputDir = resolveCodeceptOutputDir(config);
  const reportDir = resolveCodeceptReportDir(config, outputDir);

  return {
    ...config,
    apiKey: config.apiKey,
    framework: 'codeceptjs',
    outputDir,
    reportDir,
    html: config.html,
    markdown: config.markdown,
    csv: config.csv,
  };
}

function resolveCodeceptOutputDir(config = {}) {
  const codeceptStore = /** @type {{ outputDir?: string }} */ (codeceptjs.store || {});
  const candidates = [
    config.outputDir,
    config.output,
    codeceptStore.outputDir,
    codecept?.config?.get?.()?.output,
    codecept?.config?.output,
  ];

  const outputDir = candidates.find(value => typeof value === 'string' && value.trim());
  return outputDir || 'output';
}

function resolveCodeceptReportDir(config = {}, outputDir = 'output') {
  if (typeof config.reportDir === 'string' && config.reportDir.trim()) {
    return config.reportDir;
  }

  if (path.isAbsolute(outputDir)) {
    return path.join(outputDir, 'report');
  }

  return path.join(outputDir, 'report');
}
