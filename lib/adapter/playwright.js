const chalk = require('chalk');
const crypto = require('crypto');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { APP_PREFIX, STATUS: Status, TESTOMAT_TMP_STORAGE } = require('../constants');
const TestomatioClient = require('../client');
const { isArtifactsEnabled } = require('../fileUploader');
const { parseTest, fileSystem } = require('../util');

const reportTestPromises = [];

class PlaywrightReporter {
  constructor(config = {}) {
    this.client = new TestomatioClient({ apiKey: config?.apiKey });

    this.uploads = [];
  }

  onBegin(_config, suite) {
    // clean data storage
    fileSystem.clearDir(TESTOMAT_TMP_STORAGE.mainDir);
    if (!this.client) return;
    this.suite = suite;
    this.client.createRun();
  }

  // onTestBegin(test) {
  //   const testId = parseTest(test.title);
  // }

  onTestEnd(test, result) {
    if (!this.client) return;

    let testId = parseTest(test.title);

    const { title } = test;
    const { error, duration } = result;

    const suite_title = test.parent ? test.parent.title : null;

    const steps = [];
    for (const step of result.steps) {
      appendStep(step, steps);
    }

    const logs = `\n\n${chalk.bold('Logs:')}\n${chalk.red(result.stderr.join(''))}\n${result.stdout.join('')}`;

    const reportTestPromise = this.client.addTestRun(checkStatus(result.status), {
      error,
      test_id: testId,
      suite_title,
      title,
      steps: steps.join('\n'),
      time: duration,
      stack: logs,
    }).then(pipes => {
      testId = pipes?.filter(p => p.pipe.includes('Testomatio'))[0]?.result?.data?.test_id;

      this.uploads.push({
        testId, title, suite_title, files: result.attachments.filter((a) => a.body || a.path)
      });
    });

    reportTestPromises.push(reportTestPromise);
  }

  async onEnd(result) {
    if (!this.client) return;

    await Promise.all(reportTestPromises);

    if (this.uploads.length && isArtifactsEnabled()) {
      console.log(APP_PREFIX, `🎞️  Uploading ${this.uploads.length} files...`);

      const promises = [];

      for (const upload of this.uploads) {
        const { title, testId, suite_title } = upload;

        const files = upload.files.map(attachment => {
          if (attachment.body) {
            const fileName = tmpFile();
            fs.writeFileSync(fileName, attachment.body);
          }
          return { path: attachment.path, title, type: attachment.contentType };
        });

        promises.push(
          this.client.addTestRun(undefined, {
            test_id: testId,
            title,
            suite_title,
            files,
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

module.exports = PlaywrightReporter;
