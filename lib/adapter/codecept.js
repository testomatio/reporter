if (!global.codeceptjs) {
  // eslint-disable-next-line global-require, import/no-extraneous-dependencies
  global.codeceptjs = require('codeceptjs');
}

const { event, recorder, codecept } = global.codeceptjs;
const chalk = require('chalk');
const TestomatClient = require('../client');
const { FAILED } = require('../constants');
const TRConstants = require('../constants');
const upload = require('../fileUploader');
const Output = require('../output');

let currentMetaStep = [];
let error;
let stepShift = 0;

const output = new Output({
  filterFn: stack => !stack.includes('codeceptjs/lib/output'), // output from codeceptjs
});

let stepStart = new Date();

const MAJOR_VERSION = parseInt(codecept.version().match(/\d/)[0], 10);

const DATA_REGEXP = /[|\s]+?(\{".*\}|\[.*\])/;

if (MAJOR_VERSION < 3) {
  console.log('🔴 This reporter works with CodeceptJS 3+, please update your tests');
}

function CodeceptReporter(config) {
  let failedTests = [];
  let videos = [];
  const testTimeMap = {};
  const { apiKey } = config;

  if (!apiKey) {
    console.log('TESTOMATIO key is empty, ignoring reports');
    return;
  }

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
    recorder.add('Creating new run', () => client.createRun());
    videos = [];
  });

  event.dispatcher.on(event.test.before, () => {
    recorder.add(() => {
      currentMetaStep = [];
      output.reset();
      output.start();
      stepShift = 0;
    });
  });

  event.dispatcher.on(event.test.started, test => {
    testTimeMap[test.id] = Date.now();
  });

  event.dispatcher.on(event.all.result, async () => {
    if (videos.length && upload.isArtifactsEnabled) {
      console.log(TRConstants.APP_PREFIX, `🎞️  Uploading ${videos.length} videos...`);

      const promises = [];
      for (const video of videos) {
        const { testId, title, path, type } = video;
        const file = { path, type, title };
        promises.push(
          client.addTestRun(testId, undefined, {
            ...stripExampleFromTitle(title),
            files: [file],
          }),
        );
      }
      await Promise.all(promises);
    }

    const status = failedTests.length === 0 ? TRConstants.PASSED : TRConstants.FAILED;
    client.updateRunStatus(status);
  });

  event.dispatcher.on(event.test.passed, test => {
    const { id, tags, title } = test;
    if (id && failedTests.includes(id)) {
      failedTests = failedTests.filter(failed => id !== failed);
    }
    const testId = parseTest(tags);
    const testObj = getTestAndMessage(title);
    client.addTestRun(testId, TRConstants.PASSED, {
      ...stripExampleFromTitle(title),
      suite_title: test.parent && test.parent.title,
      message: testObj.message,
      time: getDuration(test),
      steps: output.text(),
    });
    output.stop();
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

      client.addTestRun(testId, TRConstants.FAILED, {
        ...stripExampleFromTitle(title),
        suite_title: suite.title,
        error,
        time: 0,
      });
    }
    output.stop();
  });

  event.dispatcher.on(event.test.after, test => {
    if (test.state && test.state !== FAILED) return;
    if (test.err) error = test.err;
    const { id, tags, title, artifacts } = test;
    failedTests.push(id || title);
    const testId = parseTest(tags);
    const testObj = getTestAndMessage(title);
    if (error && error.stack && test.steps && test.steps.length) {
      error.stack = test.steps[test.steps.length - 1].line();
    }

    const files = [];
    if (artifacts.screenshot) files.push({ path: artifacts.screenshot, type: 'image/png' });
    // todo: video must be uploaded later....
    if (artifacts.video) videos.push({ testId: id, title, path: artifacts.video, type: 'video/webm' });

    client.addTestRun(testId, TRConstants.FAILED, {
      ...stripExampleFromTitle(title),
      suite_title: test.parent && test.parent.title,
      error,
      message: testObj.message,
      time: getDuration(test),
      files,
      steps: output.text(),
    });
    output.stop();
  });

  event.dispatcher.on(event.test.skipped, test => {
    const { id, tags, title } = test;
    if (failedTests.includes(id || title)) return;

    const testId = parseTest(tags);
    const testObj = getTestAndMessage(title);
    client.addTestRun(testId, TRConstants.SKIPPED, {
      ...stripExampleFromTitle(title),
      suite_title: test.parent && test.parent.title,
      message: testObj.message,
      time: getDuration(test),
    });
    output.stop();
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
          output.push(repeat(stepShift) + chalk.bold(metaSteps[i].toString()) + metaSteps[i].comment);
        } else {
          output.push(repeat(stepShift) + chalk.green.bold(metaSteps[i].toString()));
        }
      }
    }
    currentMetaStep = metaSteps;
    stepShift = 2 * shift;

    let duration = new Date() - stepStart;
    if (duration) {
      duration = repeat(1) + chalk.grey(`(${duration}ms)`);
    }

    if (step.status === TRConstants.FAILED) {
      output.push(repeat(stepShift) + chalk.red(step.toString()) + duration);
    } else {
      output.push(repeat(stepShift) + step.toString() + duration);
    }
  });

  event.dispatcher.on(event.step.comment, step => {
    output.push(chalk.cyan.bold(step.toString()));
  });
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
