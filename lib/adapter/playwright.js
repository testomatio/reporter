const chalk = require('chalk');
const crypto = require('crypto');
const os = require('os');
const path = require('path');
const fs = require('fs');
const Status = require('../constants');
const TestomatioClient = require('../client');
const upload = require('../fileUploader');
const { parseTest } = require('../util');

class TestomatioReporter {
  constructor(config = {}) {
    const { apiKey } = config;

    if (!apiKey) {
      console.log('API Key is not provided. Testomat.io report is disabled');
    } else {
      this.client = new TestomatioClient({ apiKey });
    }

    this.videos = [];
  }

  onBegin(_config, suite) {
    if (!this.client) return;
    this.suite = suite;
    this.client.createRun();
  }

  onTestEnd(test, result) {
    if (!this.client) return;

    const testId = parseTest(test.title);

    const { title } = test;
    const { error, duration } = result;

    const suite_title = test.parent ? test.parent.title : null;

    const steps = [];
    for (const step of result.steps) {
      appendStep(step, steps);
    }

    const files = [];

    for (const attachment of result.attachments) {
      if (!attachment.body && !attachment.path) {
        continue;
      }
      if (attachment.contentType && attachment.contentType.startsWith('video')) {
        // video is post-processed
        this.videos.push({ testId, attachment, title, suite_title });
        continue;
      }

      let fileName = attachment.path;
      if (attachment.body) {
        fileName = tmpFile();
        fs.writeFileSync(fileName, attachment.body);
      }
      files.push({ path: fileName, type: attachment.contentType });
    }

    this.client.addTestRun(testId, checkStatus(result.status), {
      error,
      suite_title,
      title,
      files,
      steps: steps.join('\n'),
      time: duration,
    });
  }

  async onEnd(result) {
    if (!this.client) return;

    if (this.videos.length && upload.isArtifactsEnabled) {
      console.log(Status.APP_PREFIX, `🎞️  Uploading ${this.videos.length} videos...`);

      const promises = [];
      for (const video of this.videos) {
        const { testId, title, attachment, suite_title } = video;
        const file = { path: attachment.path, title, type: attachment.contentType };
        promises.push(
          this.client.addTestRun(testId, undefined, {
            title,
            suite_title,
            files: [file],
          }),
        );
      }
      await Promise.all(promises);
    }

    await this.client.updateRunStatus(checkStatus(result.status));
  }
}

function checkStatus(status) {
  return (
    {
      skipped: Status.SKIPPED,
      timedOut: Status.FAILED,
      passed: Status.PASSED,
    }[status] || Status.FAILED
  );
}

function appendStep(step, steps = [], shift = 0) {
  const prefix = ' '.repeat(shift);

  if (step.error) {
    steps.push(`${prefix}${chalk.red(step.title)} ${chalk.gray(`${step.duration}ms`)}`);
  } else {
    steps.push(`${prefix}${step.title} ${chalk.gray(`${step.duration}ms`)}`);
  }

  for (const child of step.steps || []) {
    appendStep(child, steps, shift + 2);
  }
}

function tmpFile(prefix = 'tmp.') {
  const tmpdir = os.tmpdir();
  return path.join(tmpdir, prefix + crypto.randomBytes(16).toString('hex'));
}

module.exports = TestomatioReporter;
