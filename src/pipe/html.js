import createDebugMessages from 'debug';
import merge from 'lodash.merge';
import fs from 'fs';
import path from 'path';
import os from 'os';
import pc from 'picocolors';
import handlebars from 'handlebars';
import fileUrl from 'file-url';
import { fileSystem, isSameTest, ansiRegExp, formatStep } from '../utils/utils.js';
import { HTML_REPORT } from '../constants.js';
import { fileURLToPath } from 'node:url';

const debug = createDebugMessages('@testomatio/reporter:pipe:html');

// @ts-ignore – this line will be removed in compiled code (already defined in the global scope of commonjs)
const __dirname = path.dirname(fileURLToPath(import.meta.url));

class HtmlPipe {
  constructor(params, store = {}) {
    this.store = store || {};
    this.title = params.title || process.env.TESTOMATIO_TITLE;
    this.apiKey = params.apiKey || process.env.TESTOMATIO;
    this.isHtml = process.env.TESTOMATIO_HTML_REPORT_SAVE;

    debug('HTML Pipe: ', this.apiKey ? 'API KEY' : '*no api key provided*');

    this.isEnabled = false;
    this.htmlOutputPath = '';
    this.filenameMsg = '';
    this.tests = [];

    if (this.isHtml) {
      this.isEnabled = true;
      this.htmlReportDir = process.env.TESTOMATIO_HTML_REPORT_FOLDER || HTML_REPORT.FOLDER;

      if (process.env.TESTOMATIO_HTML_FILENAME && process.env.TESTOMATIO_HTML_FILENAME.endsWith('.html')) {
        this.htmlReportName = process.env.TESTOMATIO_HTML_FILENAME;
      }

      if (process.env.TESTOMATIO_HTML_FILENAME && !process.env.TESTOMATIO_HTML_FILENAME.endsWith('.html')) {
        this.htmlReportName = HTML_REPORT.REPORT_DEFAULT_NAME;
        this.filenameMsg =
          'HTML filename must include the extension ".html".' +
          ` The default report name "${this.htmlReportDir}/${HTML_REPORT.REPORT_DEFAULT_NAME}" is used!`;
      }

      if (!process.env.TESTOMATIO_HTML_FILENAME) {
        this.htmlReportName = HTML_REPORT.REPORT_DEFAULT_NAME;
      }

      this.templateFolderPath = path.resolve(__dirname, '..', 'template');
      this.templateHtmlPath = path.resolve(this.templateFolderPath, HTML_REPORT.TEMPLATE_NAME);
      this.htmlOutputPath = path.join(this.htmlReportDir, this.htmlReportName);
      // create a new folder for the HTML reports
      fileSystem.createDir(this.htmlReportDir);

      debug(
        pc.yellow('HTML Pipe:'),
        `Save HTML report: ${this.isEnabled}`,
        `HTML report folder: ${this.htmlReportDir}, report name: ${this.htmlReportName}`,
      );
    }
  }

  async createRun() {
    // empty
  }

  async prepareRun() {}

  updateRun() {
    // empty
  }

  /**
   * Add test data to the result array for saving. As a result of this function, we get a result object to save.
   * @param {import('../../types/types.js').HtmlTestData} test - object which includes each test entry.
   */
  addTest(test) {
    if (!this.isEnabled) return;

    if (test?.stack && typeof test.stack === 'string') {
      test.stack = test.stack.replace(ansiRegExp(), '');
    }

    const hasPayload =
      Boolean(test?.status) ||
      (Array.isArray(test?.files) && test.files.length) ||
      (Array.isArray(test?.artifacts) && test.artifacts.length) ||
      (Array.isArray(test?.steps) && test.steps.length) ||
      Boolean(test?.message) ||
      Boolean(test?.logs) ||
      (test?.meta &&
        ((Array.isArray(test.meta.attachments) && test.meta.attachments.length) || test.meta.traces !== undefined));

    if (!hasPayload) return;

    const markerFile = path.join(os.tmpdir(), 'testomatio-main-process.marker');
    const isWorkersMode = process.env.RUNS_WITH_WORKERS;
    const isMainProcess = fs.existsSync(markerFile);

    if (isWorkersMode && !isMainProcess) {
      this.#saveTestToWorkerFile(test);
      return;
    }

    const index = this.tests.findIndex(t => isSameTest(t, test));
    if (index >= 0) {
      this.tests[index] = merge(this.tests[index], test);
      return;
    }

    this.tests.push(test);
  }

  async finishRun(runParams) {
    if (!this.isEnabled) return;

    // Skip HTML generation in worker processes (only generate in main process)
    // Detect worker by checking if marker file exists AND we're in workers mode
    const markerFile = path.join(os.tmpdir(), 'testomatio-main-process.marker');
    const isWorkersMode = process.env.RUNS_WITH_WORKERS;
    const isMainProcess = fs.existsSync(markerFile);

    if (isWorkersMode && !isMainProcess) {
      debug('HTML Pipe: Running in worker process, skipping HTML generation (will be generated in main process)');
      return;
    }

    if (isWorkersMode && isMainProcess) {
      this.#loadTestsFromWorkerFiles();
    }

    if (this.isHtml) {
      // GENERATE HTML reports based on the results data
      this.buildReport({
        runParams,
        // TODO: this.tests=[] in case of Mocha, need retest by Vitalii
        tests: this.tests,
        outputPath: this.htmlOutputPath,
        templatePath: this.templateHtmlPath,
        warningMsg: this.filenameMsg,
      });
    }
  }
  /**
   * Generates an HTML report based on provided test data and a template.
   * @param {object} opts - Test options used to generate the HTML report:
   * runParams, tests, outputPath, templatePath
   * @returns {void} - This function does not return anything.
   */

  buildReport(opts) {
    const { runParams, tests, outputPath, templatePath, warningMsg: msg } = opts;

    debug('HTML tests data:', tests);

    if (!outputPath) {
      console.log(pc.yellow(`🚨 HTML export path is not set, ignoring...`));
      return;
    }

    console.log(pc.yellow(`⏳ The test results will be added to the HTML report. It will take some time...`));

    if (msg) {
      console.log(pc.blue(msg));
    }

    const aggregatedTests = aggregateTestRetries(tests);

    aggregatedTests.forEach(test => {
      const logsRaw =
        test.logs || test.meta?.logs || test.meta?.console || test.meta?.stdout || test.meta?.stderr || '';
      const stackRaw = test.stack || '';
      const messageRaw = test.message || '';

      const { steps: stepsFromMsg, restText: messageClean } = extractStepLines(messageRaw);
      const { steps: stepsFromLogs, restText: logsClean } = extractStepLines(logsRaw);
      const { steps: stepsFromStack, restText: stackClean } = extractStepLines(stackRaw);

      let stepsTree = null;
      if (Array.isArray(test.steps) && test.steps.length) {
        const userSteps = filterUserStepsTree(test.steps);
        stepsTree = userSteps.length ? userSteps : null;
      }

      if (!stepsTree && stepsFromLogs.length > 0) {
        stepsTree = buildStepsTreeFromLogs(stepsFromLogs);
      }

      const allStepLines = [...stepsFromMsg, ...stepsFromLogs, ...stepsFromStack];
      const fallbackStepsText = allStepLines.length ? allStepLines.map((s, i) => `${i + 1}. ${s}`).join('\n') : '';

      test.message = messageClean;
      test.stack = stackClean;

      parseRetryInfo(test);

      if (test.meta?.traces !== undefined) {
        test.traces =
          typeof test.meta.traces === 'string' ? test.meta.traces : JSON.stringify(test.meta.traces, null, 2);
        delete test.meta.traces;
      }

      loadTracesFromFiles(test);

      const status = String(test.status || '').toLowerCase();
      if ((status === 'skipped' || status === 'pending') && test.meta?.todo) {
        test.status = 'todo';
      }

      prepareTestStepsForReport(test, stepsTree, allStepLines, fallbackStepsText);

      delete test._stepsFromMessage;
      test.steps = toHtmlSafe(test.steps || '');

      const rawFields = stripFailureBlock(toPlainText(logsClean));
      const rawStack = extractLogsFromStack(test.stack);

      const logsFromFields = normalizeLogs(rawFields);
      const logsFromStack = normalizeLogs(stripStepMarkedLinesRaw(rawStack));
      const logsMerged = (logsFromFields || logsFromStack).trim();

      const messageProcessed = decodeHtmlEntities(toPlainText(test.message)).trim();
      const messageNoInlineLogs = stripInlineLogsBlock(messageProcessed);
      const messageFinal = cleanNoiseBlock(messageNoInlineLogs).trim();
      const logsFinal = cleanNoiseBlock(logsMerged).trim();

      const hasStack = hasMeaningfulText(test.stack);

      const finalText = buildMessageForReport({
        status,
        messageRaw: messageFinal,
        logsText: logsFinal,
        hasStack,
      });

      test.message = toHtmlSafe(finalText);

      if (!test.suite_title?.trim()) {
        test.suite_title = 'Unknown suite';
      }

      if (!test.title?.trim()) {
        test.title = 'Unknown test title';
      }

      test.artifacts = normalizeArtifacts(test);

      const allPossibleArtifacts = [
        ...(test.artifacts || []),
        ...(test.manuallyAttachedArtifacts || []),
        ...(test.files || []),
        ...(test.meta?.attachments || []),
      ];

      test.artifactsUploaded = allPossibleArtifacts.some(artifact => {
        const link = artifact?.link || artifact?.path;
        return link && (link.startsWith('http://') || link.startsWith('https://')) && !link.startsWith('file://');
      });

      normalizeRetries(test);
      if (test.traces) {
        test.traces = typeof test.traces === 'string' ? test.traces : JSON.stringify(test.traces, null, 2);
      }
    });

    const data = {
      title: this.title || 'Test Results',
      runId: this.store.runId || '',
      status: runParams.status || 'No status info',
      parallel: runParams.isParallel || 'No parallel info',
      runUrl: this.store.runUrl || '',
      executionTime: testExecutionSumTime(aggregatedTests),
      executionDate: getCurrentDateTimeFormatted(),
      tests: aggregatedTests,
      envVars: collectEnvironmentVariables(),
    };
    // generate output HTML based on the template
    const html = this.#generateHTMLReport(data, templatePath);

    if (!html) return;

    fs.writeFileSync(outputPath, html, 'utf-8');
    // Check if the file exists
    if (fs.existsSync(outputPath)) {
      // Get the absolute path of the file
      const absolutePath = path.resolve(outputPath);
      // Convert the file path to a file URL
      const fileUrlPath = fileUrl(absolutePath, { resolve: true });

      debug('HTML tests data:', fileUrlPath);

      console.log(pc.green(`📊 The HTML report was successfully generated. Full filepath: ${fileUrlPath}`));
    } else {
      console.log(pc.red(`🚨 Failed to generate the HTML report.`));
    }
  }

  /**
   * Generates an HTML report based on provided test data and a template path.
   * @param {any} data - Test data used to generate the HTML report.
   * @param {string} [templatePath=""] - The path to the HTML template used for generating the report.
   * @returns {string | void} - The generated HTML report as a string or void if templatePath is not provided.
   */
  #generateHTMLReport(data, templatePath = '') {
    if (!templatePath) {
      console.log(pc.red(`🚨 HTML template not found. Report generation is impossible!`));
      return;
    }

    const templateSource = fs.readFileSync(templatePath, 'utf8');
    this.#loadReportHelpers();
    try {
      const template = handlebars.compile(templateSource);

      return template(data);
    } catch (e) {
      console.log(pc.red('❌ Oops! An unknown error occurred when generating an HTML report'));
      console.log(pc.red(e));
    }
  }

  #loadReportHelpers() {
    handlebars.registerHelper(
      'getTestsByStatus',
      (tests, status) => tests.filter(test => test.status.toLowerCase() === status.toLowerCase()).length,
    );

    handlebars.registerHelper('formatDuration', milliseconds => {
      if (!milliseconds || milliseconds === 0) return '0ms';

      const totalSeconds = Math.floor(milliseconds / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      const ms = milliseconds % 1000;

      if (minutes > 0) {
        return `${minutes}m ${seconds}s ${ms}ms`;
      } else if (seconds > 0) {
        return `${seconds}s ${ms}ms`;
      } else {
        return `${ms}ms`;
      }
    });

    handlebars.registerHelper(
      'selectComponent',
      () =>
        new handlebars.SafeString(
          `<select style="width: 70px;height: 38px;" class="form-select" aria-label="Tests counter on page">
          <option value="0">10</option>
          <option value="1">25</option>
          <option value="2">50</option>
        </select>`,
        ),
    );
    handlebars.registerHelper('emptyDataComponent', () => {
      const svgFilePath = path.join(__dirname, '..', 'template', 'emptyData.svg');
      const svgContent = fs.readFileSync(svgFilePath, 'utf8');

      return new handlebars.SafeString(
        `
          <div class="noData">
          <div class="noDataSvg">
            ${svgContent}
          </div>
          <div class="noDataText">
          NO MATCHING TESTS
          </div>
          <div>`,
      );
    });
    handlebars.registerHelper('pageDispleyElements', tests => {
      // We wrapp the lines to the HTML format we need
      const totalTests = JSON.parse(
        JSON.stringify(tests)
          .replace(/<script>/g, '&lt;script&gt;')
          .replace(/<\/script>/g, '&lt;/script&gt;'),
      );

      const paginationOptions = {
        0: 10,
        1: 25,
        2: 50,
      };
      const statuses = ['all', 'passed', 'failed', 'skipped', 'todo'];
      const pageItemGroups = {
        all: {},
        passed: {},
        failed: {},
        skipped: {},
        todo: {},
        totalTests,
      };

      function paginateItems(items, pageSize) {
        const paginatedItems = [];
        for (let i = 0; i < items.length; i += pageSize) {
          paginatedItems.push(items.slice(i, i + pageSize));
        }
        return paginatedItems;
      }

      statuses.forEach(status => {
        for (const option in paginationOptions) {
          if (paginationOptions.hasOwnProperty(option)) {
            const pageSize = paginationOptions[option];
            let filteredItems = totalTests;

            if (status !== 'all') {
              filteredItems = totalTests.filter(item => String(item.status).toLowerCase() === status);
            }

            pageItemGroups[status][option] = paginateItems(filteredItems, pageSize);
          }
        }
      });

      pageItemGroups.totalTests = totalTests;

      return JSON.stringify(pageItemGroups);
    });

    handlebars.registerHelper('ObjectLength', obj => {
      return Object.keys(obj).length;
    });
  }

  /**
   * Saves test data to a worker-specific temp file
   * @param {object} test - Test object to save
   */
  #saveTestToWorkerFile(test) {
    try {
      const workerId = process.env.WORKER_ID || 'unknown';
      const tempDir = os.tmpdir();
      const workerFile = path.join(tempDir, `testomatio-html-worker-${workerId}.jsonl`);

      const testLine = JSON.stringify(test) + '\n';
      fs.appendFileSync(workerFile, testLine, 'utf-8');
    } catch (err) {
      debug(`Error saving test to worker file: ${err.message}`);
    }
  }

  /**
   * Loads test data from all worker temp files
   */
  #loadTestsFromWorkerFiles() {
    try {
      const tempDir = os.tmpdir();
      const workerFiles = fs.readdirSync(tempDir)
        .filter(f => f.startsWith('testomatio-html-worker-') && f.endsWith('.jsonl'))
        .map(f => path.join(tempDir, f));

      if (workerFiles.length === 0) {
        debug('No worker test files found');
        return;
      }

      debug(`Found ${workerFiles.length} worker test file(s)`);

      for (const workerFile of workerFiles) {
        try {
          const content = fs.readFileSync(workerFile, 'utf-8');
          const lines = content.trim().split('\n').filter(line => line.trim());

          for (const line of lines) {
            try {
              const test = JSON.parse(line);
              const index = this.tests.findIndex(t => isSameTest(t, test));
              if (index >= 0) {
                this.tests[index] = merge(this.tests[index], test);
              } else {
                this.tests.push(test);
              }
            } catch (parseErr) {
              debug(`Error parsing test from worker file: ${parseErr.message}`);
            }
          }

          try {
            fs.unlinkSync(workerFile);
          } catch (unlinkErr) {
            debug(`Warning: Could not delete worker file ${workerFile}: ${unlinkErr.message}`);
          }
        } catch (readErr) {
          debug(`Error reading worker file ${workerFile}: ${readErr.message}`);
        }
      }

      debug(`Loaded ${this.tests.length} total test(s) from workers`);
    } catch (err) {
      debug(`Error loading worker test files: ${err.message}`);
    }
  }

  toString() {
    return 'HTML Reporter';
  }
}

/**
 * Calculates the total execution time for an array of tests.
 * @param {Object[]} tests - An array of test objects.
 * @param {number} tests[].run_time - The execution time of each test in milliseconds.
 * @returns {string} - The total execution time in a formatted duration string.
 */
function testExecutionSumTime(tests) {
  const totalMilliseconds = tests.reduce((sum, test) => {
    if (typeof test.run_time === 'number' && !Number.isNaN(test.run_time)) {
      return sum + test.run_time;
    }
    return sum;
  }, 0);

  return formatDuration(totalMilliseconds);
}

function parseRetryInfo(test) {
  test.retries = test.retries || { retryCount: 0, attempts: [] };

  if (test.meta && test.meta.retryCount !== undefined) {
    const n = Number(test.meta.retryCount);
    if (!Number.isNaN(n)) test.retries.retryCount = n;
  }
}

function escapeHtml(str = '') {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Converts value to plain text. Handles arrays by joining with newlines.
 * @param {string|string[]} value - String or array of strings
 * @returns {string} Plain text representation
 */
function toPlainText(value) {
  if (!value) return '';
  if (Array.isArray(value)) return value.map(v => String(v)).join('\n');
  return String(value);
}

function stripFailureBlock(text = '') {
  const t = String(text);
  const idx = t.indexOf('################[ Failure ]');
  if (idx !== -1) return t.slice(0, idx).trim();
  const idx2 = t.indexOf('[ Failure ]');
  if (idx2 !== -1) return t.slice(0, idx2).trim();
  return t.trim();
}

/**
 * Normalizes log text by removing ANSI codes and trimming whitespace.
 * Removes empty lines and trims trailing spaces from each line.
 * @param {string} text - Raw log text
 * @returns {string} Cleaned log text
 */
function normalizeLogs(text = '') {
  return String(text)
    .replace(ansiRegExp(), '')
    .split('\n')
    .map(l => l.trimEnd())
    .filter(l => l.trim())
    .join('\n')
    .trim();
}

function toHtmlSafe(value) {
  const noAnsi = toPlainText(value).replace(ansiRegExp(), '');
  return escapeHtml(noAnsi).replace(/\n/g, '<br>');
}

function hasMeaningfulText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function buildMessageForReport({ status, messageRaw, logsText, hasStack }) {
  const hasMsg = hasMeaningfulText(messageRaw);
  const hasLogs = hasMeaningfulText(logsText);

  if (status === 'failed') {
    if (hasStack) {
      return '';
    }
    const parts = [];
    if (hasMsg) parts.push(messageRaw);
    if (hasLogs) parts.push(`--- Logs ---\n${logsText}`);
    return parts.length ? parts.join('\n\n') : 'No message';
  }

  if (hasMsg) return messageRaw;
  if (hasLogs) return logsText;

  return 'No logs';
}

function stripInlineLogsBlock(text = '') {
  const t = String(text || '');

  const markers = ['--- Logs ---', '[ Logs ]', 'Logs:'];
  let cut = -1;

  for (const m of markers) {
    const i = t.indexOf(m);
    if (i !== -1) cut = cut === -1 ? i : Math.min(cut, i);
  }

  return (cut === -1 ? t : t.slice(0, cut)).trim();
}

function extractLogsFromStack(stack) {
  if (!stack) return '';

  const clean = String(stack).replace(ansiRegExp(), '');
  const lines = clean.split('\n');

  const startIdx = lines.findIndex(l => l.includes('[ Logs ]'));
  if (startIdx === -1) return '';

  let endIdx = lines.findIndex(
    (l, i) => i > startIdx && (l.includes('[ Failure ]') || l.includes('################[ Failure ]')),
  );
  if (endIdx === -1) endIdx = lines.length;

  const slice = lines.slice(startIdx + 1, endIdx);

  return slice
    .map(l => l.trimEnd())
    .filter(l => l.trim())
    .filter(l => !l.includes('[ Logs ]') && !l.includes('Logs:'))
    .join('\n')
    .trim();
}

function decodeHtmlEntities(value = '') {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&gt;/gi, '>')
    .replace(/&lt;/gi, '<')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\r\n/g, '\n');
}

function stripStepMarkedLinesRaw(text = '') {
  const t = decodeHtmlEntities(text);
  return t
    .split('\n')
    .filter(line => {
      const ln = line.replace(ansiRegExp(), '');
      return !/^\s*(?:>|&gt;|[⏩►])\s/i.test(ln);
    })
    .join('\n')
    .trim();
}

/**
 * Converts 'pending' status to 'todo' for Testomat.io display
 * @param {string} value - Status value
 * @returns {string} Status with 'pending' converted to 'todo'
 */
function normalizeStatus(value) {
  const s = String(value || '').toLowerCase();
  if (s === 'pending') return 'todo';
  return s || 'unknown';
}

function pickAttemptStatus(a) {
  if (!a) return 'unknown';

  if (a.passed === true) return 'passed';
  if (a.passed === false) return 'failed';

  return normalizeStatus(a.status ?? a.state ?? a.outcome ?? a.result ?? a.verdict ?? a.ok ?? 'unknown');
}

function pickAttemptDuration(a) {
  const n = a?.duration ?? a?.durationMs ?? a?.run_time ?? a?.time ?? a?.elapsed ?? null;

  return typeof n === 'number' && !Number.isNaN(n) ? n : null;
}

function buildAttemptsFromCount(retryCount, finalStatus) {
  const total = Math.max(1, Number(retryCount || 0) + 1);
  const arr = [];

  for (let i = 0; i < total; i++) {
    const status = i === total - 1 ? normalizeStatus(finalStatus) : 'unknown';
    arr.push({ status, duration: null });
  }

  return arr;
}

function normalizeRetries(test) {
  test.meta = test.meta || {};

  parseRetryInfo(test);

  const finalStatus = normalizeStatus(test.status);

  const attemptsRaw =
    (Array.isArray(test.attempts) && test.attempts) ||
    (Array.isArray(test.retries?.attempts) && test.retries.attempts) ||
    (Array.isArray(test.meta?.attempts) && test.meta.attempts) ||
    (Array.isArray(test.meta?.retries) && test.meta.retries) ||
    [];

  const retryCountFromMeta = typeof test.meta.retryCount === 'number' ? test.meta.retryCount : undefined;

  const retryCountFromRetries = typeof test.retries?.retryCount === 'number' ? test.retries.retryCount : undefined;

  let attemptsNormalized = [];

  if (attemptsRaw.length > 0) {
    attemptsNormalized = attemptsRaw.map(a => ({
      status: pickAttemptStatus(a),
      duration: pickAttemptDuration(a),
    }));

    const lastIdx = attemptsNormalized.length - 1;
    if (lastIdx >= 0) attemptsNormalized[lastIdx].status = finalStatus;
  } else {
    const retryCount = retryCountFromMeta ?? retryCountFromRetries ?? 0;

    attemptsNormalized = buildAttemptsFromCount(retryCount, finalStatus);
  }

  const retryCountFinal = Math.max(0, attemptsNormalized.length - 1);

  const hadFailures = attemptsNormalized.slice(0, -1).some(a => a.status === 'failed');

  const passedAfterRetries = finalStatus === 'passed' && hadFailures;

  test.retries = {
    retryCount: retryCountFinal,
    attempts: attemptsNormalized,
    hadFailures,
    passedAfterRetries,
    finalStatus,
  };

  const metaFlaky = test.meta?.flaky === true || test.meta?.isFlaky === true;

  test.flaky = Boolean(metaFlaky || passedAfterRetries);
}

/**
 * Formats duration in milliseconds into a human-readable string representation.
 * @param {number} duration - The duration in milliseconds.
 * @returns {string} - The formatted duration string (e.g., "2h 30m 15s 500ms").
 */
function formatDuration(duration) {
  const milliseconds = duration % 1000;
  duration = (duration - milliseconds) / 1000;
  const seconds = duration % 60;
  duration = (duration - seconds) / 60;
  const minutes = duration % 60;
  const hours = (duration - minutes) / 60;

  return `${hours}h ${minutes}m ${seconds}s ${milliseconds}ms`;
}

/**
 * Retrieves the current date and time in a formatted string.
 * @returns {string} - The formatted date and time string (e.g., "(01/01/2023 12:00:00)").
 */
function getCurrentDateTimeFormatted() {
  const currentDate = new Date();
  const day = currentDate.getDate().toString().padStart(2, '0');
  const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
  const year = currentDate.getFullYear();
  const hours = currentDate.getHours().toString().padStart(2, '0');
  const minutes = currentDate.getMinutes().toString().padStart(2, '0');
  const seconds = currentDate.getSeconds().toString().padStart(2, '0');

  return `(${day}/${month}/${year} ${hours}:${minutes}:${seconds})`;
}

/**
 * Aggregates duplicate test records (from retries) into a single entry
 * @param {Array} tests - Array of all tests
 * @returns {Array} - Aggregated array of tests
 */
function aggregateTestRetries(tests) {
  if (!Array.isArray(tests) || tests.length === 0) return tests;

  const grouped = new Map();

  for (const t of tests) {
    const rid = t?.rid || t?.meta?.rid || t?.meta?.RID || t?.meta?.runRid || t?.meta?.testRid;

    const key = rid ? `rid:${rid}` : `ft:${t?.file || ''}|${t?.title || ''}`;

    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(t);
  }

  const aggregated = [];

  grouped.forEach(group => {
    if (group.length === 1) {
      aggregated.push(group[0]);
      return;
    }

    const attemptsOnly = group.filter(x => x && x.status);
    const base = attemptsOnly.length ? attemptsOnly[attemptsOnly.length - 1] : group[group.length - 1];

    const allFiles = [];
    const allArtifacts = [];
    const allMetaAttachments = [];
    const allManual = [];

    for (const x of group) {
      if (Array.isArray(x?.files)) allFiles.push(...x.files);
      if (Array.isArray(x?.artifacts)) allArtifacts.push(...x.artifacts);
      if (Array.isArray(x?.meta?.attachments)) allMetaAttachments.push(...x.meta.attachments);
      if (Array.isArray(x?.manuallyAttachedArtifacts)) allManual.push(...x.manuallyAttachedArtifacts);
      if (Array.isArray(x?.meta?.manuallyAttachedArtifacts)) allManual.push(...x.meta.manuallyAttachedArtifacts);
    }

    const attempts = attemptsOnly.map(a => ({
      status: normalizeStatus(a.status),
      duration: a.run_time || a.time || 0,
    }));

    const retryCount = Math.max(0, attempts.length - 1);
    const hadFailures = attempts.slice(0, -1).some(a => a.status === 'failed');
    const finalStatus = normalizeStatus(base.status);
    const passedAfterRetries = finalStatus === 'passed' && hadFailures;

    const merged = merge({}, base);

    if (allFiles.length) merged.files = allFiles;
    if (allArtifacts.length) merged.artifacts = allArtifacts;

    merged.meta = merged.meta || {};
    if (allMetaAttachments.length) {
      merged.meta.attachments = [...(merged.meta.attachments || []), ...allMetaAttachments];
    }
    if (allManual.length) {
      merged.manuallyAttachedArtifacts = [...(merged.manuallyAttachedArtifacts || []), ...allManual];
    }

    merged.retries = {
      retryCount,
      attempts,
      hadFailures,
      passedAfterRetries,
      finalStatus,
    };
    merged.flaky = Boolean(passedAfterRetries || merged.meta?.flaky || merged.meta?.isFlaky);

    aggregated.push(merged);
  });

  return aggregated;
}

function extractStepLines(raw = '') {
  const text = decodeHtmlEntities(toPlainText(raw || ''));
  if (!text.trim()) return { steps: [], restText: '' };

  const lines = text.split('\n');
  const steps = [];
  const rest = [];

  for (const line of lines) {
    const cleanedLine = line.replace(ansiRegExp(), '');
    const stepMatch = cleanedLine.match(/^\s*(?:>|&gt;|[⏩►])\s*(.+?)\s*$/i);
    if (stepMatch) {
      steps.push(stepMatch[1].trim());
      continue;
    }

    const stepWithLabel = cleanedLine.match(/^\s*(?:>|&gt;|[⏩►]\s*)?\s*Step:\s*(.+)\s*$/i);
    if (stepWithLabel) {
      steps.push(stepWithLabel[1].trim());
      continue;
    }

    if (/^\s*Step\s*\d+\s*$/i.test(cleanedLine)) continue;

    rest.push(line);
  }

  return { steps, restText: rest.join('\n').trim() };
}

function filterUserStepsTree(steps) {
  if (!Array.isArray(steps)) return [];

  const isUserStep = s => String(s?.category || '').toLowerCase() === 'user';

  const walk = arr => {
    const out = [];
    for (const s of arr) {
      if (!s) continue;

      const children = walk(s.steps || []);

      if (isUserStep(s)) {
        const copy = { ...s };
        if (children.length) copy.steps = children;
        else delete copy.steps;
        out.push(copy);
      } else if (children.length) {
        out.push(...children);
      }
    }
    return out;
  };

  return walk(steps);
}

/**
 * Builds a tree structure from a flat array of step names
 * This is used when steps are stored as logs (like in Playwright)
 * @param {string[]} stepLines - Array of step names
 * @returns {Array} - Tree structure of steps
 */
function buildStepsTreeFromLogs(stepLines) {
  if (!Array.isArray(stepLines) || stepLines.length === 0) return [];

  const result = [];
  const stack = [];
  const indentStack = [];

  stepLines.forEach(line => {
    if (!line || !line.trim()) return;

    const text = line.trim();
    const indent = line.search(/\S/);

    while (indentStack.length > 0 && indentStack[indentStack.length - 1] >= indent) {
      stack.pop();
      indentStack.pop();
    }

    const stepObj = {
      category: 'user',
      title: text,
      duration: 0,
    };

    if (stack.length === 0) {
      result.push(stepObj);
    } else {
      const parent = stack[stack.length - 1];
      if (!parent.steps) parent.steps = [];
      parent.steps.push(stepObj);
    }

    stack.push(stepObj);
    indentStack.push(indent);
  });

  return result;
}

function cleanNoiseBlock(text = '') {
  const t = decodeHtmlEntities(String(text || '')).replace(ansiRegExp(), '');

  let lines = t
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  lines = dropISayEcho(lines);

  return lines.join('\n').trim();
}

function dropISayEcho(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const cur = lines[i];
    const prev = out[out.length - 1];

    const m = prev && prev.match(/^I say\s+"([\s\S]*)"$/);
    if (m) {
      const said = m[1];
      if (cur === said) continue;
    }

    out.push(cur);
  }
  return out;
}

/**
 * Collects all Testomatio and S3 environment variables
 * Uses hardcoded list to avoid file system dependencies for end users
 * @returns {Object} Object with TESTOMATIO_ and S3_ variables grouped
 */
function collectEnvironmentVariables() {
  return getHardcodedEnvVars();
}

/**
 * Process environment variables configuration and collect their values
 * @param {Object} varConfigs - Object with variable configurations { [key]: { description } }
 * @param {Set} sensitiveVars - Set of sensitive variable names
 * @returns {Object} Processed environment variables with metadata
 */
function processEnvironmentVariables(varConfigs, sensitiveVars) {
  const result = {};

  for (const [key, config] of Object.entries(varConfigs)) {
    const value = process.env[key];
    const isSensitive = sensitiveVars.has(key);

    if (isSensitive) {
      if (value !== undefined) {
        result[key] = { value: '***', description: config.description, isSet: true, isSensitive: true };
      } else {
        result[key] = { value: '', description: config.description, isSet: false, isSensitive: true };
      }
    } else {
      if (value !== undefined) {
        result[key] = { value, description: config.description, isSet: true };
      } else {
        result[key] = { value: '', description: config.description, isSet: false };
      }
    }
  }

  return result;
}

/**
 * Hardcoded environment variables stored in code
 * This is the main source of truth for env vars to avoid file system dependencies
 * @returns {Object} Object with TESTOMATIO_ and S3_ variables
 */
function getHardcodedEnvVars() {
  const allVars = {
    testomatio: {
      TESTOMATIO: { description: 'API Key for Testomat.io' },
      TESTOMATIO_API_KEY: { description: 'API Key (alias for TESTOMATIO)' },
      TESTOMATIO_CREATE: { description: 'Create new tests in Testomat.io' },
      TESTOMATIO_DEBUG: { description: 'Enable debug mode' },
      TESTOMATIO_DISABLE_BATCH_UPLOAD: { description: 'Disable batch upload' },
      TESTOMATIO_ENV: { description: 'Environment label (e.g., "Windows, Chrome")' },
      TESTOMATIO_EXCLUDE_FILES_FROM_REPORT_GLOB_PATTERN: { description: 'Glob pattern to exclude files' },
      TESTOMATIO_EXCLUDE_SKIPPED: { description: 'Exclude skipped tests from report' },
      TESTOMATIO_FILENAME: { description: 'HTML report filename' },
      TESTOMATIO_HTML_FILENAME: { description: 'HTML report filename' },
      TESTOMATIO_HTML_REPORT_FOLDER: { description: 'Folder for HTML report' },
      TESTOMATIO_HTML_REPORT_SAVE: { description: 'Save HTML report' },
      TESTOMATIO_INTERCEPT_CONSOLE_LOGS: { description: 'Intercept console logs' },
      TESTOMATIO_MARK_DETACHED: { description: 'Mark tests as detached' },
      TESTOMATIO_MAX_REQUEST_FAILURES: { description: 'Max request failures' },
      TESTOMATIO_MAX_REQUEST_FAILURES_COUNT: { description: 'Max request failures count' },
      TESTOMATIO_MAX_REQUEST_RETRIES_WITHIN_TIME_SECONDS: { description: 'Max retries within time period' },
      TESTOMATIO_NO_STEPS: { description: 'Disable steps reporting' },
      TESTOMATIO_NO_TIMESTAMP: { description: 'Remove timestamps from logs' },
      TESTOMATIO_PROCEED: { description: 'Proceed even if tests fail' },
      TESTOMATIO_PUBLISH: { description: 'Publish results to Testomat.io' },
      TESTOMATIO_REQUEST_TIMEOUT: { description: 'Request timeout in milliseconds' },
      TESTOMATIO_RUN: { description: 'Run ID to report tests to' },
      TESTOMATIO_RUNGROUP_TITLE: { description: 'Title for run group' },
      TESTOMATIO_SHARED_RUN: { description: 'Share run for parallel execution' },
      TESTOMATIO_SHARED_RUN_TIMEOUT: { description: 'Timeout for shared run (in seconds)' },
      TESTOMATIO_STACK_ARTIFACTS: { description: 'Stack artifacts in report' },
      TESTOMATIO_STACK_FILTER: { description: 'Filter stack traces' },
      TESTOMATIO_STACK_PASSED: { description: 'Report stack for passed tests' },
      TESTOMATIO_STEPS_PASSED: { description: 'Report steps for passed tests' },
      TESTOMATIO_SUITE: { description: 'Suite ID for new tests' },
      TESTOMATIO_TOKEN: { description: 'API Token (alias for TESTOMATIO)' },
      TESTOMATIO_TITLE: { description: 'Title for the test run' },
      TESTOMATIO_URL: { description: 'Testomat.io URL (custom instance)' },
      TESTOMATIO_WORKDIR: { description: 'Working directory for relative paths' },
    },
    s3: {
      S3_ACCESS_KEY_ID: { description: 'S3 access key ID' },
      S3_BUCKET: { description: 'S3 bucket name' },
      S3_ENDPOINT: { description: 'S3 endpoint URL' },
      S3_FORCE_PATH_STYLE: { description: 'S3 force path style' },
      S3_KEY: { description: 'S3 access key' },
      S3_PREFIX: { description: 'S3 key prefix' },
      S3_REGION: { description: 'S3 region' },
      S3_SECRET: { description: 'S3 secret key' },
      S3_SECRET_ACCESS_KEY: { description: 'S3 secret access key' },
      S3_SESSION_TOKEN: { description: 'S3 session token' },
    },
  };

  const sensitiveVars = new Set([
    'TESTOMATIO',
    'TESTOMATIO_TOKEN',
    'TESTOMATIO_API_KEY',
    'S3_KEY',
    'S3_SECRET',
    'S3_ACCESS_KEY_ID',
    'S3_SECRET_ACCESS_KEY',
    'S3_SESSION_TOKEN',
  ]);

  const envVars = {
    testomatio: processEnvironmentVariables(allVars.testomatio, sensitiveVars),
    s3: processEnvironmentVariables(allVars.s3, sensitiveVars),
  };

  return envVars;
}

/**
 * Prepares test steps for HTML report display
 * @param {object} test - Test object
 * @param {Array} stepsTree - Steps tree from logs
 * @param {Array} allStepLines - All step lines from message/logs/stack
 * @param {string} fallbackStepsText - Fallback steps text
 */
function prepareTestStepsForReport(test, stepsTree, allStepLines, fallbackStepsText) {
  if (Array.isArray(test.steps) && test.steps.length) {
    const userSteps = filterUserStepsTree(test.steps);
    test.stepsArray = userSteps;

    if (userSteps.length) {
      test.steps = userSteps
        .map(s => formatStep(s))
        .flat()
        .join('\n');
    } else if (stepsTree) {
      test.stepsArray = stepsTree;
      test.steps = stepsTree.map(s => formatStep(s)).flat().join('\n');
    } else if (fallbackStepsText) {
      test.stepsArray = allStepLines.map(t => ({ category: 'user', title: t, duration: 0 }));
      test.steps = fallbackStepsText;
    } else {
      test.steps = '';
      test.stepsArray = [];
    }
  } else if (stepsTree) {
    test.stepsArray = stepsTree;
    test.steps = stepsTree.map(s => formatStep(s)).flat().join('\n');
  } else if (fallbackStepsText) {
    test.stepsArray = allStepLines.map(t => ({ category: 'user', title: t, duration: 0 }));
    test.steps = fallbackStepsText;
  } else if (typeof test.steps === 'string' && test.steps.trim()) {
    test.stepsArray = [];
    test.steps = String(test.steps).replace(ansiRegExp(), '').trim();
  } else {
    test.steps = '';
    test.stepsArray = [];
  }
}

/**
 * Normalizes artifacts from different sources into a unified format
 * @param {object} test - Test object with artifacts
 * @returns {Array} - Normalized artifacts array with trace files filtered out
 */
function normalizeArtifacts(test) {
  test.artifacts = test.artifacts || [];
  test.meta = test.meta || {};

  const allArtifacts = [
    ...(test.artifacts || []),
    ...(test.meta?.attachments || []),
    ...(test.manuallyAttachedArtifacts || []),
    ...(test.files || []),
    ...(test.meta?.manuallyAttachedArtifacts || []),
  ];

  return allArtifacts
    .map(artifact => {
      if (typeof artifact === 'string') {
        const abs = path.isAbsolute(artifact) ? artifact : path.resolve(process.cwd(), artifact);
        const href = artifact.startsWith('file://') ? artifact : fileUrl(abs, { resolve: true });
        const base = path.basename(abs);

        return {
          name: base,
          title: base,
          path: href,
          fsPath: abs,
          relativePath: artifact,
        };
      }

      if (artifact?.path) {
        const raw = String(artifact.path);
        const isFileUrl = raw.startsWith('file://');
        const abs = isFileUrl ? null : path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
        const href = isFileUrl ? raw : fileUrl(abs, { resolve: true });
        const base = abs ? path.basename(abs) : artifact.name || artifact.title || 'attachment';

        return {
          ...artifact,
          name: artifact.name || artifact.title || base,
          title: artifact.title || artifact.name || base,
          path: href,
          fsPath: abs || artifact.fsPath || null,
          relativePath: artifact.relativePath || raw,
        };
      }

      return artifact;
    })
    .filter(Boolean)
    .filter(artifact => {
      const isTrace = (artifact.title === 'trace' || artifact.name === 'trace') &&
        (artifact.type === 'application/zip' ||
        artifact.path?.endsWith('.zip') ||
        artifact.relativePath?.endsWith('.zip'));
      return !isTrace;
    });
}

/**
 * Loads trace files from test.files and converts them to base64 data URLs
 * @param {object} test - Test object with files array
 */
function loadTracesFromFiles(test) {
  if (!test.traces && test.files && Array.isArray(test.files) && test.files.length > 0) {
    const traceFiles = test.files.filter(f =>
      f.path &&
      f.path.trim().length > 0 &&
      (f.title === 'trace' || f.name === 'trace') &&
      (f.type === 'application/zip' || f.path.endsWith('.zip'))
    );

    if (traceFiles.length > 0) {
      const traceDataList = [];
      traceFiles.forEach(f => {
        if (!fs.existsSync(f.path)) {
          console.warn(`Trace file not found: ${f.path}`);
          return;
        }

        try {
          const fileBuffer = fs.readFileSync(f.path, null);

          if (!fileBuffer || fileBuffer.length === 0) {
            console.warn(`Empty trace file: ${f.path}`);
            return;
          }
          const base64 = fileBuffer.toString('base64');

          let filename = 'trace.zip';
          try {
            filename = path.basename(f.path);
          } catch (e) {
            console.warn(`Could not extract filename from ${f.path}, using default`);
          }

          const dataUrl = `data:application/zip;base64,${base64}`;

          traceDataList.push({
            dataUrl,
            name: filename
          });

        } catch (e) {
          console.error(`Failed to convert trace to base64: ${f.path}`, e.message);
        }
      });

      if (traceDataList.length > 0) {
        test.traces = traceDataList;
      }
    }
  }
}

export default HtmlPipe;
