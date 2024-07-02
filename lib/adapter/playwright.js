const chalk = require('chalk');
const crypto = require('crypto');
const os = require('os');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const { APP_PREFIX, STATUS: Status, TESTOMAT_TMP_STORAGE_DIR } = require('../constants');
const TestomatioClient = require('../client');
const { isArtifactsEnabled } = require('../fileUploader');
const { getTestomatIdFromTestTitle, fileSystem } = require('../utils/utils');
// const debug = require('debug')('@testomatio/reporter:adapter:playwright');
const { services } = require('../services');
const { dataStorage } = require('../data-storage');

const reportTestPromises = [];

class PlaywrightReporter {
  constructor(config = {}) {
    this.client = new TestomatioClient({ apiKey: config?.apiKey });

    this.uploads = [];
  }

  onBegin(config, suite) {
    // clean data storage
    fileSystem.clearDir(TESTOMAT_TMP_STORAGE_DIR);
    if (!this.client) return;
    this.suite = suite;
    this.config = config;
    this.client.createRun();
  }

  onTestBegin(testInfo) {
    const fullTestTitle = getTestContextName(testInfo);
    dataStorage.setContext(fullTestTitle);
  }

  onTestEnd(test, result) {
    if (!this.client) return;

    const { title } = test;

    const { error, duration } = result;

    const suite_title = test.parent ? test.parent?.title : path.basename(test?.location?.file);

    const steps = [];
    for (const step of result.steps) {
      appendStep(step, steps);
    }

    const fullTestTitle = getTestContextName(test);
    let logs = '';
    if (result.stderr.length || result.stdout.length) {
      logs = `\n\n${chalk.bold('Logs:')}\n${chalk.red(result.stderr.join(''))}\n${result.stdout.join('')}`;
    }
    const manuallyAttachedArtifacts = services.artifacts.get(fullTestTitle);
    const keyValues = services.keyValues.get(fullTestTitle);

    const rid = test.id || test.testId || uuidv4();

    const reportTestPromise = this.client.addTestRun(checkStatus(result.status), {
        rid,
        error,
        test_id: getTestomatIdFromTestTitle(`${title} ${test.tags?.join(' ')}`),
        suite_title,
        title,
        steps: steps.join('\n'),
        time: duration,
        logs,
        manuallyAttachedArtifacts,
        meta: keyValues,
        file: test.location?.file,
      });

    this.uploads.push({
      rid,
      title: test.title,
      files: result.attachments.filter(a => a.body || a.path),
      file: test.location?.file,
    });
    // remove empty uploads
    this.uploads = this.uploads.filter(upload => upload.files.length);

    reportTestPromises.push(reportTestPromise);
  }

  #getArtifactPath(artifact) {
    if (artifact.path) {
      if (path.isAbsolute(artifact.path)) return artifact.path;

      return path.join(this.config.outputDir || this.config.projects[0].outputDir, artifact.path);
    }

    if (artifact.body) {
      const fileName = tmpFile();
      fs.writeFileSync(fileName, artifact.body);
      return fileName;
    }

    return null;
  }

  async onEnd(result) {
    if (!this.client) return;

    await Promise.all(reportTestPromises);

    if (this.uploads.length && isArtifactsEnabled()) {
      console.log(APP_PREFIX, `🎞️  Uploading ${this.uploads.length} files...`);

      const promises = [];

      for (const upload of this.uploads) {
        const { rid, file, title } = upload;

        const files = upload.files.map(attachment => ({
          path: this.#getArtifactPath(attachment),
          title,
          type: attachment.contentType,
        }));

        promises.push(
          this.client.addTestRun(undefined, {
            rid,
            title,
            files,
            file,
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

/**
 * Returns filename + test title
 * @param {*} test - testInfo object from Playwright
 * @returns
 */
function getTestContextName(test) {
  return `${test._requireFile || ''}_${test.title}`;
}

function initPlaywrightForStorage() {
  try {
    // @ts-ignore-next-line
    // eslint-disable-next-line import/no-unresolved
    const { test } = require('@playwright/test');
    // eslint-disable-next-line no-empty-pattern
    test.beforeEach(async ({}, testInfo) => {
      global.testomatioTestTitle = `${testInfo.file || ''}_${testInfo.title}`;
    });
  } catch (e) {
    // ignore
  }
}

module.exports = PlaywrightReporter;
module.exports.initPlaywrightForStorage = initPlaywrightForStorage;
