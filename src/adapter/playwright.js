import pc from 'picocolors';
import crypto from 'crypto';
import os from 'os';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { APP_PREFIX, STATUS as Status, TESTOMAT_TMP_STORAGE_DIR } from '../constants.js';
import TestomatioClient from '../client.js';
import { upload } from '../fileUploader.js';
import { getTestomatIdFromTestTitle, fileSystem } from '../utils/utils.js';
import { services } from '../services/index.js';
import { dataStorage } from '../data-storage.js';

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
    // test.parent.project().__projectId

    if (!this.client) return;

    const { title } = test;
    const { error, duration } = result;
    const suite_title = test.parent ? test.parent?.title : path.basename(test?.location?.file);

    const steps = [];
    for (const step of result.steps) {
      const appendedStep = appendStep(step);
      if (appendedStep) {
        steps.push(appendedStep);
      }
    }

    const fullTestTitle = getTestContextName(test);
    let logs = '';
    if (result.stderr.length || result.stdout.length) {
      logs = `\n\n${pc.bold('Logs:')}\n${pc.red(result.stderr.join(''))}\n${result.stdout.join('')}`;
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
      steps: steps.length ? steps : undefined,
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
    this.uploads = this.uploads.filter(anUpload => anUpload.files.length);

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

    if (this.uploads.length && upload.isArtifactsEnabled()) {
      console.log(APP_PREFIX, `🎞️  Uploading ${this.uploads.length} files...`);

      const promises = [];

      for (const anUpload of this.uploads) {
        const { rid, file, title } = anUpload;

        const files = anUpload.files.map(attachment => ({
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

function appendStep(step, shift = 0) {
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
    resultStep.steps = formattedSteps;
  }

  if (step.error !== undefined) {
    resultStep.error = step.error;
  }

  return resultStep;
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
    // eslint-disable-next-line import/no-extraneous-dependencies
    const { test } = require('@playwright/test');
    // eslint-disable-next-line no-empty-pattern
    test.beforeEach(async ({}, testInfo) => {
      global.testomatioTestTitle = `${testInfo.file || ''}_${testInfo.title}`;
    });
  } catch (e) {
    // ignore
  }
}

export default PlaywrightReporter;
export { initPlaywrightForStorage };
