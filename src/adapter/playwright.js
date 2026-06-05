import crypto from 'crypto';
import os from 'os';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { APP_PREFIX, STATUS as Status, TESTOMAT_TMP_STORAGE_DIR, SCREENSHOTS_ON_STEPS } from '../constants.js';
import TestomatioClient from '../client.js';
import { getTestomatIdFromTestTitle, fileSystem, truncate } from '../utils/utils.js';
import { services } from '../services/index.js';
import { dataStorage } from '../data-storage.js';
import { extensionMap } from '../utils/constants.js';
import pc from 'picocolors';
import { fetchLinksFromLogs } from './utils/playwright.js';
import { formatStep, addStatusToStep, addArtifactsToStep } from './utils/step-formatter.js';
import { log } from '../utils/log.js';

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

  async onTestEnd(test, result) {
    // test.parent.project().__projectId

    if (!this.client) return;

    const { title } = test;
    const { error, duration } = result;
    const pwAttachments = (result.attachments || []).filter(a => a.body || a.path);

    const files = pwAttachments
      .map(att => ({
        path: this.#getArtifactPath(att),
        title: att.name || title,
        type: att.contentType,
      }))
      .filter(f => f.path);

    const suite_title = test.parent ? test.parent?.title : path.basename(test?.location?.file);

    const rid = test.id || test.testId || uuidv4();

    /**
     * @type {{
     * browser?: string,
     * dependencies: string[],
     * isMobile?: boolean
     * metadata: Record<string, any>,
     * name: string,
     * }}
     */
    const project = {
      browser: test.parent.project().use.defaultBrowserType,
      dependencies: test.parent.project().dependencies,
      isMobile: test.parent.project().use.isMobile,
      metadata: test.parent.project().metadata,
      name: test.parent.project().name,
    };

    const steps = result.steps.map(step => appendStep(step, 0)).filter(step => step !== null);

    // Extract and normalize tags
    const tags = extractTags(test);

    const fullTestTitle = getTestContextName(test);

    let logs = '';
    // get links along with filtered logs (liks related logs removed)
    const { stdout: filteredStdout, links, meta } = fetchLinksFromLogs(result.stdout);
    if (filteredStdout?.length || result.stderr?.length) {
      logs = `\n\n${pc.bold('Logs:')}\n${pc.red(result.stderr.join(''))}\n${filteredStdout.join('')}`;
    }

    /*
      All services fucntions work different for Playwright.
      We don't have access to test title (as result, to test id) when calling this functions inside a test.
      Thus, when user calls services functions inside a test, we just log this data to console.
      Playwright intercepts the console.log on it's end and we just get this data from it.
      Thus, we have a tiny drawback: all data from services functions inside a test will be logged to console.
      And this requires a condition to be added for each service function – if its Playwright, then log to console.

      "get" method of services will not return data for Playwright, we should parse stdout.
    */
    const manuallyAttachedArtifacts = services.artifacts.get(fullTestTitle);
    const testMeta = services.keyValues.get(fullTestTitle);

    let status = result.status;
    // process test.fail() annotation
    if (test.expectedStatus === 'failed') {
      // actual status = expected
      if (result.status === 'failed') status = 'passed';
      // actual status != expected
      if (result.status === 'passed') status = 'failed';
    }

    const reportTestPromise = this.client.addTestRun(checkStatus(status), {
      rid: `${rid}-${project.name}`,
      error,
      test_id: getTestomatIdFromTestTitle(`${title} ${tags.join(' ')}`),
      suite_title,
      title,
      tags: tags.map(tag => tag.replace('@', '')),
      steps: steps.length ? steps : undefined,
      time: duration,
      logs,
      links,
      manuallyAttachedArtifacts,
      files: files.length ? files : undefined,
      meta: {
        browser: project.browser,
        isMobile: project.isMobile,
        project: project.name,
        projectDependencies: project.dependencies?.length ? project.dependencies : null,
        ...testMeta,
        ...meta,
        ...project.metadata, // metadata has any type (in playwright), but we will stringify it in client.js
        ...test.annotations?.reduce((acc, annotation) => {
          if (acc[annotation.type]) {
            acc[annotation.type] = `${acc[annotation.type]}, ${annotation.description}`;
          } else {
            acc[annotation.type] = annotation.description;
          }
          return acc;
        }, {}),
      },
      file: test.location?.file,
    });

    this.uploads.push({
      rid: `${rid}-${project.name}`,
      title: test.title,
      files: pwAttachments,
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
      let filePath = generateTmpFilepath(artifact.name);
      const hasExtension = artifact.name && path.extname(artifact.name);
      if (!hasExtension && artifact.contentType) {
        const extension = extensionMap[artifact.contentType] || artifact.contentType.split('/')[1];
        if (extension) filePath += `.${extension}`;
      }
      fs.writeFileSync(filePath, artifact.body);
      return filePath;
    }
    return null;
  }

  async onEnd(result) {
    if (!this.client) return;

    await Promise.all(reportTestPromises);

    if (this.uploads.length) {
      if (this.client.uploader.isEnabled) log.info(`🎞️ Uploading ${this.uploads.length} files...`);

      const promises = [];

      // ? possible move to addTestRun (needs investigation if files are ready)
      for (const upload of this.uploads) {
        const { rid, file, title } = upload;

        const files = upload.files.map(attachment => ({
          path: this.#getArtifactPath(attachment),
          title,
          type: attachment.contentType,
        }));

        if (!this.client.uploader.isEnabled) {
          files.forEach(f => this.client.uploader.storeUploadedFile(f, this.client.runId, rid, false));
          continue;
        }

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

  const resultStep = formatStep({
    category: newCategory,
    title: step.title,
    duration: step.duration,
  });

  // Add status based on error
  addStatusToStep(resultStep, step.error ? 'failed' : 'passed', step.error);

  // Add error if present
  if (step.error !== undefined) {
    if (typeof step.error === 'object') {
      resultStep.error = {
        message: truncate(String(step.error.message), 250),
        stack: truncate(String(step.error.stack || ''), 250),
      };
    } else {
      resultStep.error = truncate(String(step.error), 250);
    }
  }

  // Add log if present
  if (step.log) {
    resultStep.log = truncate(String(step.log), 250);
  }

  // Add artifacts from attachments
  if (step.attachments && step.attachments.length > 0 && SCREENSHOTS_ON_STEPS) {
    const screenshotAttachment = step.attachments.find(att =>
      att.contentType === 'image/png' && att.name === 'screenshot'
    );
    if (screenshotAttachment && screenshotAttachment.path) {
      const artifacts = { screenshot: screenshotAttachment.path };
      addArtifactsToStep(resultStep, artifacts);
    }
  }

  // Process nested steps
  const formattedSteps = [];
  for (const child of step.steps || []) {
    const appendedChild = appendStep(child, shift + 2);
    if (appendedChild) {
      formattedSteps.push(appendedChild);
    }
  }

  if (formattedSteps.length) {
    resultStep.steps = formattedSteps.filter(s => !!s);
  }

  return resultStep;
}

function generateTmpFilepath(filename = '') {
  filename = filename || `tmp.${crypto.randomBytes(16).toString('hex')}`;
  const tmpdir = os.tmpdir();
  return path.join(tmpdir, filename);
}

/**
 * Extracts tags from test title, test options, and suite level
 * Identifies duplicate tags (case-insensitive)
 * @param {*} test - testInfo object from Playwright
 * @returns {string[]} - array of normalized tags with @ prefix
 */
function extractTags(test) {
  const tagsMap = new Map(); // key: lowercase tag, value: original case tag

  function addTag(tag) {
    if (typeof tag !== 'string') return;
    const trimmed = tag.trim();
    if (!trimmed) return;
    const normalizedTag = trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
    const lowercaseTag = normalizedTag.toLowerCase();
    if (!tagsMap.has(lowercaseTag)) {
      tagsMap.set(lowercaseTag, normalizedTag);
    }
  }

  // Extract tags from test title (@tag format); only test title is considered
  const titleTagsMatch = test.title.match(/@[A-Za-z0-9_-]+/g) || [];
  titleTagsMatch.forEach(addTag);

  // Extract tags from test.tags (Playwright built-in tags); ignore parents
  if (Array.isArray(test.tags)) {
    test.tags.forEach(addTag);
  }

  return Array.from(tagsMap.values());
}

/**
 * Returns filename + test title
 * @param {*} test - testInfo object from Playwright
 * @returns
 */
function getTestContextName(test) {
  return `${test._requireFile || ''}_${test.title}`;
}

export default PlaywrightReporter;
export { extractTags, fetchLinksFromLogs };
