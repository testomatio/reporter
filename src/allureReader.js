import createDebugMessages from 'debug';
import path from 'path';
import pc from 'picocolors';
import fs from 'fs';
import { glob } from 'glob';
import { APP_PREFIX, STATUS } from './constants.js';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { S3Uploader } from './uploader.js';
import { pipesFactory } from './pipe/index.js';
import {
  fetchSourceCode,
  fetchIdFromCode,
} from './utils/utils.js';
import adapterFactory from './junit-adapter/index.js';

// @ts-ignore
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const debug = createDebugMessages('@testomatio/reporter:allure');

const TESTOMATIO_URL = process.env.TESTOMATIO_URL || 'https://app.testomat.io';
const { TESTOMATIO_RUNGROUP_TITLE, TESTOMATIO_SUITE, TESTOMATIO_TITLE, TESTOMATIO_ENV, TESTOMATIO_RUN } = process.env;

class AllureReader {
  constructor(opts = {}) {
    this.requestParams = {
      apiKey: opts.apiKey || config.TESTOMATIO,
      url: opts.url || TESTOMATIO_URL,
      title: TESTOMATIO_TITLE,
      env: TESTOMATIO_ENV,
      group_title: TESTOMATIO_RUNGROUP_TITLE,
      isBatchEnabled: true,
    };
    this.runId = opts.runId || TESTOMATIO_RUN;
    this.opts = opts || {};
    this.withPackage = opts.withPackage || false;
    this.store = {};
    this.pipesPromise = pipesFactory(opts, this.store);
    this._tests = [];
    this.stats = {};
    this.suites = {};
    this.uploader = new S3Uploader();

    const packageJsonPath = path.resolve(__dirname, '..', 'package.json');
    this.version = JSON.parse(fs.readFileSync(packageJsonPath).toString()).version;
    console.log(APP_PREFIX, `Testomatio Reporter v${this.version}`);
  }

  get tests() {
    return this._tests;
  }

  set tests(value) {
    this._tests = value;
  }

  async createRun() {
    const runParams = {
      api_key: this.requestParams.apiKey,
      title: this.requestParams.title,
      env: this.requestParams.env,
      group_title: this.requestParams.group_title,
      isBatchEnabled: this.requestParams.isBatchEnabled,
    };

    debug('Run', runParams);
    this.pipes = this.pipes || (await this.pipesPromise);

    const run = await Promise.all(this.pipes.map(p => p.createRun(runParams)));
    this.uploader.checkEnabled();
    return run;
  }

  parse(resultsPattern) {
    this._tests = [];
    let pattern = resultsPattern;

    // Auto-append wildcard if pattern refers to a directory (like XML command does)
    if (!pattern.endsWith('.json') && !pattern.includes('*')) {
      if (pattern.endsWith('/') || (fs.existsSync(pattern) && fs.statSync(pattern).isDirectory())) {
        pattern = pattern.replace(/\/+$/, '') + '/*-result.json';
      } else {
        pattern += '*-result.json';
      }
    }

    const resultsDir = path.dirname(pattern);

    console.log(APP_PREFIX, `Scanning for Allure results in: ${resultsDir}`);
    console.log(APP_PREFIX, `Using pattern: ${pattern}`);

    const resultFiles = glob.sync(pattern);
    const containerFiles = glob.sync(pattern.replace('*-result.json', '*-container.json'));

    if (resultFiles.length === 0 && containerFiles.length === 0) {
      throw new Error(`No Allure result files found matching pattern: ${pattern}`);
    }

    console.log(APP_PREFIX, `Found ${resultFiles.length} result files and ${containerFiles.length} container files`);

    this.parseContainerFiles(containerFiles);

    // Store all tests temporarily for deduplication by historyId
    const allTests = [];
    for (const file of resultFiles) {
      const fullPath = file;
      const fileDir = path.dirname(file);
      try {
        const resultData = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        const test = this.processAllureResult(resultData, fileDir);
        if (test) {
          test._historyId = resultData.historyId;
          test._stop = resultData.stop || 0;
          allTests.push(test);
        }
      } catch (err) {
        console.warn(APP_PREFIX, `Failed to parse ${file}:`, err.message);
        debug('Parse error:', err);
      }
    }

    const attemptsMap = new Map();
    for (const test of allTests) {
      const historyId = test._historyId || test.rid;
      if (!attemptsMap.has(historyId)) {
        attemptsMap.set(historyId, []);
      }
      attemptsMap.get(historyId).push(test);
    }

    const uniqueTestsMap = new Map();
    for (const [historyId, attempts] of attemptsMap) {
      uniqueTestsMap.set(historyId, this.combineRetryAttempts(attempts));
    }

    // Convert map to array and clean up internal fields
    this._tests = Array.from(uniqueTestsMap.values()).map(t => {
      delete t._historyId;
      delete t._stop;
      return t;
    });

    console.log(APP_PREFIX, `Processed ${this._tests.length} unique tests (from ${allTests.length} result files)`);

    return this.calculateStats();
  }

  parseContainerFiles(containerFiles) {
    for (const file of containerFiles) {
      try {
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (data.name && data.children) {
          data.children.forEach(uuid => {
            this.suites[uuid] = data.name;
          });
        }
      } catch (err) {
        debug('Failed to parse container file:', file, err.message);
      }
    }
    debug('Parsed suites:', this.suites);
  }

  processAllureResult(result, resultsDir) {
    const test = {
      rid: result.uuid || randomUUID(),
      title: result.name || 'Unknown test',
      status: this.mapStatus(result.status),
      suite_title: this.extractSuiteTitle(result),
      file: this.extractFile(result),
      run_time: this.calculateRunTime(result),
      steps: this.convertSteps(result.steps || []),
      message: result.statusDetails?.message || '',
      stack: result.statusDetails?.trace || '',
      meta: this.extractMeta(result),
      links: this.extractLinks(result),
      artifacts: [],
      create: true,
      overwrite: true,
    };

    // Add description if present
    if (result.description) {
      test.description = result.description;
    }

    if (result.parameters && result.parameters.length > 0) {
      test.example = this.convertParameters(result.parameters);
    }

    if (result.attachments && result.attachments.length > 0) {
      const attachments = result.attachments
        .map(att => {
          const fullPath = path.join(resultsDir, att.source);
          if (fs.existsSync(fullPath)) {
            return fullPath;
          }
          debug('Attachment file not found:', fullPath);
          return null;
        })
        .filter(Boolean);

      if (attachments.length > 0) {
        test.files = attachments;
      }
    }

    return test;
  }

  mapStatus(status) {
    const statusMap = {
      passed: 'passed',
      failed: 'failed',
      broken: 'failed',
      skipped: 'skipped',
      pending: 'skipped',
    };
    return statusMap[status] || 'failed';
  }

  extractSuiteTitle(result) {
    const labels = result.labels || [];

    // Only use suite label for suite_title
    // Epic and Feature are sent as separate labels in meta
    const suiteLabel = labels.find(l => l.name === 'suite')?.value;

    if (suiteLabel) {
      return this.stripNamespace(suiteLabel);
    }

    // Fallback to parentSuite or subSuite if no suite label
    const parentSuite = labels.find(l => l.name === 'parentSuite')?.value;
    const subSuite = labels.find(l => l.name === 'subSuite')?.value;

    if (parentSuite && subSuite) {
      return `${parentSuite} / ${subSuite}`;
    }
    if (parentSuite) return parentSuite;
    if (subSuite) return subSuite;

    return 'Default Suite';
  }

  stripNamespace(suiteName) {
    if (suiteName && suiteName.includes('.')) {
      return suiteName.split('.').pop();
    }
    return suiteName;
  }

  extractFile(result) {
    const labels = result.labels || [];
    const packageLabel = labels.find(l => l.name === 'package')?.value;
    const testClassLabel = labels.find(l => l.name === 'testClass')?.value;

    if (!packageLabel) {
      return null;
    }

    const ext = this.getFileExtension(result);
    let className;

    if (testClassLabel) {
      className = testClassLabel.split('.').pop();
    } else if (result.fullName) {
      const fullNameParts = result.fullName.split('.');
      className = fullNameParts[fullNameParts.length - 2] || fullNameParts[fullNameParts.length - 1];
    } else {
      return null;
    }

    if (this.withPackage) {
      const parts = packageLabel.split('.');
      return `${parts.join('/')}/${className}.${ext}`;
    }

    return `${className}.${ext}`;
  }

  getFileExtension(result) {
    const labels = result.labels || [];
    const languageLabel = labels.find(l => l.name === 'language')?.value;

    const extMap = {
      java: 'java',
      kotlin: 'kt',
      javascript: 'js',
      typescript: 'ts',
      python: 'py',
      ruby: 'rb',
      'c#': 'cs',
      php: 'php',
    };

    return extMap[languageLabel?.toLowerCase()] || 'java';
  }

  extractMeta(result) {
    const labels = result.labels || [];
    // Exclude suite, package, epic, feature from meta (they're handled separately)
    // epic and feature are sent as links instead
    const excludedLabels = ['suite', 'package', 'parentSuite', 'subSuite', 'testClass', 'testMethod', 'epic', 'feature'];

    const meta = {};
    labels.forEach(label => {
      if (!excludedLabels.includes(label.name)) {
        meta[label.name] = label.value;
      }
    });

    return meta;
  }

  extractLinks(result) {
    const labels = result.labels || [];
    const links = [];

    const epicLabel = labels.find(l => l.name === 'epic');
    const featureLabel = labels.find(l => l.name === 'feature');

    if (epicLabel?.value) {
      links.push({ label: `epic:${epicLabel.value}` });
    }

    if (featureLabel?.value) {
      links.push({ label: `feature:${featureLabel.value}` });
    }

    return links.length > 0 ? links : undefined;
  }

  convertSteps(steps, depth = 0) {
    if (depth >= 10) return null;

    return steps
      .map(step => {
        const convertedStep = {
          category: 'user',
          title: step.name || step.title || 'Unknown step',
          duration: this.calculateRunTime(step),
          steps: this.convertSteps(step.steps || [], depth + 1),
        };

        if (convertedStep.steps && convertedStep.steps.length === 0) {
          delete convertedStep.steps;
        }

        if (convertedStep.duration === 0) {
          delete convertedStep.duration;
        }

        return convertedStep;
      })
      .filter(Boolean);
  }

  calculateRunTime(item) {
    if (item.start && item.stop) {
      const durationMs = item.stop - item.start;
      return durationMs / 1000;
    }
    return null;
  }

  convertParameters(parameters) {
    const example = {};
    parameters.forEach(param => {
      if (param.name) {
        example[param.name] = param.value;
      }
    });
    return example;
  }

  combineRetryAttempts(attempts) {
    attempts.sort((a, b) => (a._stop || 0) - (b._stop || 0));

    const finalTest = attempts[attempts.length - 1];
    const retryCount = attempts.length - 1;

    if (retryCount > 0) {
      finalTest.retries = retryCount;
    }

    const failedAttempts = attempts.filter(t => t.status === 'failed');

    if (failedAttempts.length === 0) {
      return finalTest;
    }

    const failureMessages = [];
    const failureStacks = [];

    for (const failed of failedAttempts) {
      const attemptNum = attempts.indexOf(failed) + 1;
      if (failed.message) {
        failureMessages.push(`[Attempt ${attemptNum}] ${failed.message}`);
      }
      if (failed.stack) {
        failureStacks.push(`\n--- Attempt ${attemptNum} ---\n${failed.stack}`);
      }
    }

    if (failureMessages.length > 0) {
      finalTest.message = failureMessages.join('\n');
    }
    if (failureStacks.length > 0) {
      finalTest.stack = failureStacks.join('\n');
    }

    if (finalTest.status === 'passed') {
      finalTest.status = 'failed';
      finalTest.message = `Test passed after ${failedAttempts.length} retries. Previous failures:\n${finalTest.message}`;
    }

    return finalTest;
  }

  calculateStats() {
    this.stats = {
      create_tests: true,
      tests_count: this._tests.length,
      passed_count: 0,
      failed_count: 0,
      skipped_count: 0,
      duration: 0,
      status: 'passed',
      tests: this._tests,
    };
    this._tests.forEach(t => {
      if (t.status === 'passed') this.stats.passed_count++;
      if (t.status === 'failed') this.stats.failed_count++;
      if (t.status === 'skipped') this.stats.skipped_count++;
    });
    this.stats.duration = this._tests.reduce((acc, t) => acc + (t.run_time || 0), 0);
    if (this.stats.failed_count) this.stats.status = 'failed';

    debug('Stats:', this.stats);
    return this.stats;
  }

  fetchSourceCode() {
    const adapter = this.adapter || adapterFactory(this.getLanguage(), this.opts);

    this._tests.forEach(t => {
      try {
        let filePath = t.file;

        if (adapter && adapter.getFilePath) {
          filePath = adapter.getFilePath(t);
        }

        if (!filePath) return;

        if (!fs.existsSync(filePath)) {
          debug('Source file not found:', filePath);
          return;
        }

        const contents = fs.readFileSync(filePath).toString();
        const code = fetchSourceCode(contents, { ...t, lang: this.getLanguage() });
        if (code) {
          t.code = code;
          debug('Fetched code for test %s', t.title);
        }

        const testId = fetchIdFromCode(contents, { lang: this.getLanguage() });
        if (testId) {
          t.test_id = testId;
          debug('Fetched test id %s for test %s', testId, t.title);
        }
      } catch (err) {
        debug('Failed to fetch source code:', err.message);
      }
    });
  }

  getLanguage() {
    if (this._tests.length === 0) return null;
    return this._tests[0].meta?.language || this.opts.lang;
  }

  async uploadArtifacts() {
    for (const test of this._tests.filter(t => t.files && t.files.length > 0)) {
      const runId = this.runId || this.store.runId || Date.now().toString();
      const artifacts = await Promise.all(
        test.files.map(f => this.uploader.uploadFileByPath(f, [runId, test.rid, path.basename(f)])),
      );
      test.artifacts = artifacts.filter(a => a && a.link).map(a => a.link);
      delete test.files;
      if (test.artifacts.length > 0) {
        console.log(APP_PREFIX, `🗄️ Uploaded ${pc.bold(`${test.artifacts.length} artifacts`)} for test ${test.title}`);
      }
    }
  }

  async uploadData() {
    await this.uploadArtifacts();
    this.calculateStats();
    this.fetchSourceCode();

    const dataString = {
      ...this.stats,
      api_key: this.requestParams.apiKey,
      status: 'finished',
      duration: this.stats.duration,
      tests: this._tests,
    };

    debug('Uploading data', dataString);

    this.pipes = this.pipes || (await this.pipesPromise);
    return Promise.all(this.pipes.map(p => p.finishRun(dataString)));
  }
}

export default AllureReader;
