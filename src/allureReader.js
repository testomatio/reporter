import createDebugMessages from 'debug';
import path from 'path';
import pc from 'picocolors';
import fs from 'fs';
import { glob } from 'glob';
import { APP_PREFIX, STATUS, BATCH_MODE } from './constants.js';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { S3Uploader } from './uploader.js';
import { pipesFactory } from './pipe/index.js';
import { splitTestsIntoChunks } from './utils/pipe_utils.js';
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
      // Buffer tests and flush them manually in size-limited chunks, exactly like XmlReader.
      // No setInterval auto-upload means each test is sent exactly once (no double-send).
      batchMode: BATCH_MODE.MANUAL,
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

    // Allure results already contain steps and stack traces for all tests,
    // so enable passing them for passed tests by default
    if (!process.env.TESTOMATIO_STACK_PASSED) {
      process.env.TESTOMATIO_STACK_PASSED = '1';
    }
    if (!process.env.TESTOMATIO_STEPS_PASSED) {
      process.env.TESTOMATIO_STEPS_PASSED = '1';
    }

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
      batchMode: this.requestParams.batchMode,
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

    // Use the @TmsLink / Testomat.io link as the test id so reported tests MATCH
    // existing cases instead of creating duplicates on every run.
    const testId = this.extractTestId(result);
    if (testId) {
      test.test_id = testId;
    }

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

  /**
   * Map an Allure step status to the Testomat.io Step status enum
   * (`passed | failed | none | custom`, see testomat-api-definition.yml).
   *
   * Allure marks a step `broken` when it threw an unexpected error — that is a
   * failure for reporting purposes, matching how `mapStatus` treats tests.
   * `skipped` and anything unknown/absent become `none` (the neutral value),
   * since the step enum has no `skipped`.
   *
   * @param {string} status - Allure step status
   * @returns {'passed'|'failed'|'none'} Testomat.io step status
   */
  mapStepStatus(status) {
    const statusMap = {
      passed: 'passed',
      failed: 'failed',
      broken: 'failed',
      skipped: 'none',
      pending: 'none',
    };
    return statusMap[status] || 'none';
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
    const excludedLabels = [
      'suite', 'package', 'parentSuite', 'subSuite',
      'testClass', 'testMethod', 'epic', 'feature',
    ];

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

  /**
   * Extract a Testomat.io test id from Allure links so reported tests match
   * existing cases instead of creating duplicates.
   *
   * Allure's `@TmsLink("T1a2b3c4d")` produces a link with `type: "tms"`. Some exporters
   * omit the type but still point the link URL at a Testomat.io test page; both are
   * accepted. The link `name` is used as the id (falling back to the last URL segment).
   *
   * @param {object} result - Parsed Allure result JSON
   * @returns {string|null} Normalized test id, or null when no usable link exists
   */
  extractTestId(result) {
    const links = result.links || [];
    if (!links.length) return null;

    const isTmsLink = l => typeof l?.type === 'string' && l.type.toLowerCase() === 'tms';
    const isTestomatioLink = l => typeof l?.url === 'string' && /testomat\.io\/[^\s]*\/test\//i.test(l.url);

    const link = links.find(isTmsLink) || links.find(isTestomatioLink);
    if (!link) return null;

    // Prefer the explicit link name; fall back to the id segment of a Testomat.io URL.
    let id = this.normalizeTestId(link.name);
    if (!id && typeof link.url === 'string') {
      const fromUrl = link.url.match(/\/test\/([\w\d]{8})(?=$|[/?#])/i);
      if (fromUrl) id = fromUrl[1];
    }

    return id;
  }

  /**
   * Normalize a value into a Testomat.io test id.
   *
   * Testomat.io test ids are exactly **8 word characters**. The value may arrive bare
   * (`1a2b3c4d`), or carrying the `T` / `@T` markers Testomat uses in code and titles
   * (`T1a2b3c4d`, `@T1a2b3c4d`). The markers are removed only when doing so still leaves
   * a valid 8-char id, so a real id that happens to start with `T` is preserved.
   *
   * Anything that does not resolve to a valid 8-char id — a numeric Allure TestOps id
   * like `12345`, a JIRA key, a 6-digit TMS number — is rejected (returns null) so we
   * never send an unmatchable id that would create duplicates.
   *
   * @param {string|number|null|undefined} value
   * @returns {string|null} The bare 8-char id, or null when the value is not a valid id
   */
  normalizeTestId(value) {
    if (value === null || value === undefined) return null;
    const match = value.toString().trim().match(/^@?T?([\w\d]{8})$/);
    return match ? match[1] : null;
  }

  /**
   * Recover a Testomat.io test id from the `@TmsLink("…")` annotation in test source.
   *
   * Allure does not emit link annotations for skipped (`@Ignore` / `@Disabled`) tests,
   * so their results carry no `tms` link and `extractTestId` returns null — which makes
   * the server create a duplicate case. The id still lives in the source, on the test
   * method, so we read it from there as a fallback.
   *
   * The lookup is method-scoped: we locate the test method declaration by name, then
   * scan upward across its annotation/comment block (the lines directly above it) for
   * `@TmsLink`. Scanning stops at the first real code line so an unrelated method's
   * annotation can never be picked up.
   *
   * @param {string} contents - full source file
   * @param {object} test - converted test (uses `title`)
   * @returns {string|null} normalized 8-char id, or null
   */
  extractTmsIdFromSource(contents, test) {
    if (!contents || !test || !test.title) return null;

    const lines = contents.split('\n');
    const title = test.title.replace(/[([].*$/, '').trim();
    if (!title) return null;
    const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Locate the test method declaration (Kotlin `fun name(`, then a typed declaration,
    // then a generic `name(` fallback for other JVM languages).
    let idx = lines.findIndex(l => new RegExp(`\\bfun\\s+${escaped}\\s*\\(`).test(l));
    if (idx === -1) idx = lines.findIndex(l => new RegExp(`\\b[\\w.<>\\[\\]]+\\s+${escaped}\\s*\\(`).test(l));
    if (idx === -1) idx = lines.findIndex(l => new RegExp(`\\b${escaped}\\s*\\(`).test(l));
    if (idx === -1) return null;

    const tmsRe = /@TmsLink\s*\(\s*["']([^"']+)["']\s*\)/;
    for (let i = idx - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line === '') continue;
      const isAnnotation = line.startsWith('@');
      const isComment =
        line.startsWith('//') || line.startsWith('*') || line.startsWith('/*') || line.startsWith('*/');
      if (!isAnnotation && !isComment) break; // reached code outside this method's annotation block
      const match = line.match(tmsRe);
      if (match) return this.normalizeTestId(match[1]);
    }

    return null;
  }

  convertSteps(steps, depth = 0) {
    if (depth >= 10) return null;

    return steps
      .map(step => {
        const convertedStep = {
          category: 'user',
          title: step.name || step.title || 'Unknown step',
          status: this.mapStepStatus(step.status),
          duration: this.calculateRunTime(step),
          steps: this.convertSteps(step.steps || [], depth + 1),
        };

        // Attach the failure description (error message + trace with the failing
        // code line) straight onto the failed step. Testomat.io renders a step's
        // `error` inline in the step tree, so the failure shows up on the exact
        // step that broke instead of only at the test level.
        //
        // Allure propagates a failure's statusDetails up the whole step chain, so
        // every ancestor of the real failure point is also `failed` and carries
        // the same message. To avoid repeating it at every level, only surface the
        // error on the deepest failed step — skip it whenever a descendant step
        // already shows the error.
        const error = this.extractStepError(step);
        if (error && !this.subtreeHasError(convertedStep.steps)) {
          convertedStep.error = error;
        }

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

  /**
   * Check whether any step in the given (already converted) subtree already
   * carries an `error`. Used to keep the failure message on the deepest failed
   * step only, instead of repeating it on every ancestor in the failure chain.
   *
   * @param {Array<object>|undefined} steps - converted child steps
   * @returns {boolean}
   */
  subtreeHasError(steps) {
    if (!steps || !steps.length) return false;
    return steps.some(step => step.error || this.subtreeHasError(step.steps));
  }

  /**
   * Build the `error` payload for a failed step from its Allure `statusDetails`.
   *
   * Allure stores the failure message and stack trace (which includes the failing
   * source line) in `statusDetails` on the step itself. We only surface it for
   * failed/broken steps — passing or skipped steps carry no error. Returns null
   * when there is no usable failure information so the field is omitted entirely.
   *
   * @param {object} step - Allure step
   * @returns {{message: string, stack: string}|null}
   */
  extractStepError(step) {
    if (this.mapStepStatus(step.status) !== 'failed') return null;

    const details = step.statusDetails || {};
    const message = details.message || '';
    const stack = details.trace || '';

    if (!message && !stack) return null;

    return { message, stack };
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

    // When the final attempt passed (after earlier failures) keep the test as passed —
    // this mirrors the server's overwrite-by-latest retry model. The aggregated failure
    // message/stack built above is retained so the flakiness history stays visible.
    if (finalTest.status === 'passed') {
      const retryMsg = `Test passed after ${failedAttempts.length} retries. Previous failures:\n`;
      finalTest.message = retryMsg + finalTest.message;
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

        // Don't override an id already taken from a @TmsLink — the link is the
        // explicit, source-independent match key the client maintains.
        const testId = fetchIdFromCode(contents, { lang: this.getLanguage() });
        if (testId && !t.test_id) {
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

  /**
   * Fill in `test_id` for tests that have none by reading the `@TmsLink` annotation
   * from their source. This rescues skipped (`@Ignore` / `@Disabled`) tests, whose
   * Allure results drop the `@TmsLink` link and would otherwise create duplicate cases.
   *
   * Opt-in: only runs when `--java-tests` (a source root) is provided. The source
   * files are indexed once by basename; for each id-less test we read the candidate
   * file(s) matching its `testFile` / class name and parse the method's `@TmsLink`.
   */
  recoverTestIdsFromSource() {
    const root = this.opts.javaTests;
    if (!root) return;

    const missing = this._tests.filter(t => !t.test_id);
    if (!missing.length) return;

    if (!fs.existsSync(root)) {
      debug('java-tests source root not found: %s', root);
      return;
    }

    const index = this.indexSourceFiles(root);
    let recovered = 0;

    for (const t of missing) {
      for (const filePath of this.sourceCandidatesForTest(t, index)) {
        let contents;
        try {
          contents = fs.readFileSync(filePath).toString();
        } catch (err) {
          debug('Failed to read source %s: %s', filePath, err.message);
          continue;
        }
        const id = this.extractTmsIdFromSource(contents, t);
        if (id) {
          t.test_id = id;
          recovered++;
          debug('Recovered test id %s from @TmsLink in %s for %s', id, filePath, t.title);
          break;
        }
      }
    }

    if (recovered) {
      console.log(APP_PREFIX, `🔗 Recovered ${pc.bold(recovered)} test id(s) from @TmsLink in source`);
    }
  }

  /**
   * Build (and cache) a basename -> [absolute paths] index of source files under `root`.
   * Walks synchronously, skipping common build/dependency directories.
   *
   * @param {string} root
   * @returns {Map<string, string[]>}
   */
  indexSourceFiles(root) {
    if (this._sourceIndex) return this._sourceIndex;

    const exts = new Set(['.kt', '.java', '.py', '.rb', '.cs']);
    const skipDirs = new Set(['node_modules', '.git', 'build', 'out', 'target', '.gradle', 'dist', 'bin']);
    const index = new Map();
    const stack = [root];

    while (stack.length) {
      const dir = stack.pop();
      let entries;
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch (err) {
        debug('Failed to read dir %s: %s', dir, err.message);
        continue;
      }
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!skipDirs.has(entry.name)) stack.push(full);
        } else if (exts.has(path.extname(entry.name))) {
          const list = index.get(entry.name) || [];
          list.push(full);
          index.set(entry.name, list);
        }
      }
    }

    this._sourceIndex = index;
    return index;
  }

  /**
   * Candidate source file paths for a test, looked up in the basename index.
   * Uses the `testFile` meta label (e.g. `Foo.kt`) and the class name from `file`,
   * trying both `.kt` and `.java` extensions. Ambiguity (same basename in several
   * dirs) is harmless: only the file that actually declares the method will match.
   *
   * @param {object} t
   * @param {Map<string, string[]>} index
   * @returns {string[]}
   */
  sourceCandidatesForTest(t, index) {
    const names = new Set();
    if (t.meta?.testFile) names.add(t.meta.testFile);
    if (t.file) {
      const base = path.basename(t.file);
      names.add(base);
      const stem = base.replace(/\.[^.]+$/, '');
      ['kt', 'java'].forEach(ext => names.add(`${stem}.${ext}`));
    }

    const paths = [];
    for (const name of names) {
      (index.get(name) || []).forEach(p => paths.push(p));
    }
    return paths;
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
    this.recoverTestIdsFromSource();

    this.pipes = this.pipes || (await this.pipesPromise);

    const finishData = {
      api_key: this.requestParams.apiKey,
      status: 'finished',
      duration: this.stats.duration,
    };

    if (!this._tests || !Array.isArray(this._tests) || this._tests.length === 0) {
      debug('No tests to upload, finishing run');
      return Promise.all(this.pipes.map(p => p.finishRun(finishData)));
    }

    // Upload tests in size-limited chunks (max 1MB each), exactly like XmlReader.
    // The testomatio pipe runs in MANUAL batch mode, so addTest only buffers tests and
    // sync() flushes one batch request per chunk. There is no setInterval auto-upload,
    // so each test is sent exactly once (no double-send) and requests stay under the limit.
    const testChunks = splitTestsIntoChunks(this._tests);

    const totalChunks = testChunks.length;
    const totalTests = this._tests.length;

    debug(`Split ${totalTests} tests into ${totalChunks} chunks (max 1MB per chunk)`);

    let uploadedTests = 0;
    for (let i = 0; i < testChunks.length; i++) {
      const chunk = testChunks[i];

      if (totalChunks > 1) {
        debug(`Uploading chunk ${i + 1}/${totalChunks} (${chunk.length} tests)`);
      }

      // Buffer each test in the chunk, then flush the whole chunk as a single batch
      for (const test of chunk) {
        await Promise.all(this.pipes.map(p => p.addTest(test)));
      }
      await Promise.all(this.pipes.map(p => p.sync()));

      uploadedTests += chunk.length;
      debug(`Uploaded ${uploadedTests}/${totalTests} tests`);
    }

    if (totalChunks > 1) {
      console.log(APP_PREFIX, `✅ Successfully uploaded ${uploadedTests} tests in ${totalChunks} chunks`);
    } else {
      console.log(APP_PREFIX, `✅ Successfully uploaded ${uploadedTests} tests`);
    }

    debug('Uploaded %d tests, finishing run', this._tests.length);

    return Promise.all(this.pipes.map(p => p.finishRun(finishData)));
  }
}

export default AllureReader;
