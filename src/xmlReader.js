import createDebugMessages from 'debug';
import path from 'path';
import pc from 'picocolors';
import fs from 'fs';
import { XMLParser } from 'fast-xml-parser';
import { APP_PREFIX, STATUS } from './constants.js';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import {
  fetchFilesFromStackTrace,
  fetchIdFromOutput,
  fetchSourceCode,
  fetchSourceCodeFromStackTrace,
  fetchIdFromCode,
  humanize,
  TEST_ID_REGEX,
} from './utils/utils.js';
import { pipesFactory } from './pipe/index.js';
import adapterFactory from './junit-adapter/index.js';
import { config } from './config.js';
import { S3Uploader } from './uploader.js';

// @ts-ignore this line will be removed in compiled code, because __dirname is defined in commonjs
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const debug = createDebugMessages('@testomatio/reporter:xml');

const ridRunId = randomUUID();

const TESTOMATIO_URL = process.env.TESTOMATIO_URL || 'https://app.testomat.io';
const {
  TESTOMATIO_RUNGROUP_TITLE,
  TESTOMATIO_SUITE,
  TESTOMATIO_MAX_STACK_TRACE,
  TESTOMATIO_TITLE,
  TESTOMATIO_ENV,
  TESTOMATIO_RUN,
  TESTOMATIO_MARK_DETACHED,
} = process.env;

const options = {
  ignoreDeclaration: true,
  ignoreAttributes: false,
  alwaysCreateTextNode: false,
  attributeNamePrefix: '',
  parseTagValue: true,
};

const MAX_OUTPUT_LENGTH = parseInt(TESTOMATIO_MAX_STACK_TRACE, 10) || 10000;

const reduceOptions = {};

class XmlReader {
  constructor(opts = {}) {
    this.requestParams = {
      apiKey: opts.apiKey || config.TESTOMATIO,
      url: opts.url || TESTOMATIO_URL,
      title: TESTOMATIO_TITLE,
      env: TESTOMATIO_ENV,
      group_title: TESTOMATIO_RUNGROUP_TITLE,
      detach: TESTOMATIO_MARK_DETACHED,
      // batch uploading is implemented for xml already
      isBatchEnabled: false,
    };
    this.runId = opts.runId || TESTOMATIO_RUN;
    this.adapter = adapterFactory(opts.lang?.toLowerCase(), opts);
    if (!this.adapter) throw new Error('XML adapter for this format not found');

    this.opts = opts || {};
    this.store = {};
    this.pipesPromise = pipesFactory(opts, this.store);

    this.parser = new XMLParser(options);
    this.tests = [];
    this.stats = {};
    this.stats.language = opts.lang?.toLowerCase();
    this.uploader = new S3Uploader();

    // @ts-ignore
    const packageJsonPath = path.resolve(__dirname, '..', 'package.json');
    this.version = JSON.parse(fs.readFileSync(packageJsonPath).toString()).version;
    console.log(APP_PREFIX, `Testomatio Reporter v${this.version}`);
  }

  connectAdapter() {
    if (this.opts.javaTests) {
      this.adapter = adapterFactory('java', this.opts);
      return this.adapter;
    }
    this.adapter = adapterFactory(this.stats.language, this.opts);
    return this.adapter;
  }

  parse(fileName) {
    let xmlData = fs.readFileSync(path.resolve(fileName)).toString();

    // we remove too long stack traces
    const cutRegexes = [
      /(<output><!\[CDATA\[)([\s\S]*?)(\]\]><\/output>)/g,
      /(<system-err><!\[CDATA\[)([\s\S]*?)(\]\]><\/system-err>)/g,
      /(<system-out><!\[CDATA\[)([\s\S]*?)(\]\]><\/system-out>)/g,
    ];

    for (const regex of cutRegexes) {
      xmlData = xmlData.replace(regex, (_, p1, p2, p3) => `${p1}${p2.substring(0, MAX_OUTPUT_LENGTH)}${p3}`);
    }

    const jsonResult = this.parser.parse(xmlData);
    let jsonSuite;

    if (jsonResult.testsuites) {
      jsonSuite = jsonResult.testsuites;
    } else if (jsonResult.testsuite) {
      jsonSuite = jsonResult;
    } else if (jsonResult.TestRun) {
      return this.processTRX(jsonResult);
    } else if (jsonResult['test-run']) {
      return this.processNUnit(jsonResult['test-run']);
    } else if (jsonResult.assemblies) {
      return this.processXUnit(jsonResult.assemblies);
    } else {
      console.log(jsonResult);
      throw new Error("Format can't be parsed");
    }

    return this.processJUnit(jsonSuite);
  }

  processJUnit(jsonSuite) {
    const { testsuite, name, tests, failures, errors } = jsonSuite;

    reduceOptions.preferClassname = this.stats.language === 'python';
    const resultTests = processTestSuite(testsuite);

    const hasFailures = resultTests.filter(t => t.status === 'failed').length > 0;
    const status = failures > 0 || errors > 0 || hasFailures ? 'failed' : 'passed';

    const time = testsuite.time || 0;
    // debug('time', jsonSuite, time)
    if (time) {
      if (!this.stats.duration) this.stats.duration = 0;
      this.stats.duration += parseFloat(time);
    }

    this.tests = this.tests.concat(resultTests);

    return {
      create_tests: true,
      duration: parseFloat(time),
      failed_count: parseInt(failures, 10),
      name,
      passed_count: parseInt(tests, 10) - parseInt(failures, 10),
      skipped_count: 0,
      status,
      tests: resultTests,
      tests_count: parseInt(tests, 10),
    };
  }

  processNUnit(jsonSuite) {
    const { result, total, passed, failed, inconclusive, skipped } = jsonSuite;

    reduceOptions.preferClassname = this.stats.language === 'python';
    const resultTests = processTestSuite(jsonSuite['test-suite']);

    this.tests = this.tests.concat(resultTests);

    return {
      status: result?.toLowerCase(),
      create_tests: true,
      tests_count: parseInt(total, 10),
      passed_count: parseInt(passed, 10),
      failed_count: parseInt(failed, 10),
      skipped_count: parseInt(inconclusive + skipped, 10),
      tests: resultTests,
    };
  }

  processTRX(jsonSuite) {
    let defs = jsonSuite?.TestRun?.TestDefinitions?.UnitTest;
    if (!Array.isArray(defs)) defs = [defs].filter(d => !!d);

    const tests =
      defs.map(td => {
        const title = td.name.replace(/\(.*?\)/, '').trim();
        let example = td.name.match(/\((.*?)\)/);
        if (example) example = { ...example[1].split(',') };
        const suite = td.TestMethod.className.split(', ')[0].split('.');
        const suite_title = suite.pop();
        return {
          title,
          example,
          file: suite.join('/'),
          description: td.Description,
          suite_title,
          id: td.Execution.id,
        };
      }) || [];

    let result = jsonSuite?.TestRun?.Results?.UnitTestResult;
    if (!Array.isArray(result)) result = [result].filter(d => !!d);

    const results = result.map(td => ({
      id: td.executionId,
      // seconds are used in junit reports, but ms are used by testomatio
      run_time: parseFloat(td.duration) * 1000,
      status: td.outcome,
      stack: td.Output.StdOut,
      files: td?.ResultFiles?.ResultFile?.map(rf => rf.path),
    }));

    results.forEach(r => {
      const test = tests.find(t => t.id === r.id) || {};
      r.suite_title = test.suite_title;
      r.title = test.title?.trim();
      if (test.code) r.code = test.code;
      if (test.description) r.description = test.description;
      if (test.example) r.example = test.example;
      if (test.file) r.file = test.file;
      r.create = true;
      r.overwrite = true;
      if (r.status === 'Passed') r.status = STATUS.PASSED;
      if (r.status === 'Failed') r.status = STATUS.FAILED;
      if (r.status === 'Skipped') r.status = STATUS.SKIPPED;
      delete r.id;
    });

    debug(results);

    const counters = jsonSuite?.TestRun?.ResultSummary?.Counters || {};

    const failed_count = parseInt(counters.failed, 10) + parseInt(counters.error, 10);

    let status = STATUS.PASSED.toString();
    if (failed_count > 0) status = STATUS.FAILED;

    this.tests = results.filter(t => !!t.title);

    return {
      status,
      create_tests: !process.env.IGNORE_NEW_TESTS,
      tests_count: parseInt(counters.total, 10),
      passed_count: parseInt(counters.passed, 10),
      skipped_count: parseInt(counters.notExecuted, 10),
      failed_count,
      tests: results,
    };
  }

  processXUnit(assemblies) {
    const tests = [];

    assemblies = Array.isArray(assemblies.assembly) ? assemblies.assembly : [assemblies.assembly];

    assemblies.forEach(assembly => {
      const { collection } = assembly;

      const suites = Array.isArray(collection) ? collection : [collection];

      suites.forEach(suite => {
        const { test } = suite;
        if (!test) return;
        const cases = Array.isArray(test) ? test : [test];
        cases.forEach(testCase => {
          const { type, time, result } = testCase;

          let message = '';
          let stack = '';

          if (testCase.failure) {
            message = testCase.failure.message;
            stack = testCase.failure['stack-trace'];
          }
          if (testCase.reason) {
            message = testCase.reason.message;
          }

          let status = STATUS.PASSED;
          if (result === 'Pass') status = STATUS.PASSED;
          if (result === 'Fail') status = STATUS.FAILED;
          if (result === 'Skip') status = STATUS.SKIPPED;

          const pathParts = type.split('.');
          const suite_title = pathParts[pathParts.length - 1];
          const file = pathParts.slice(0, -1).join('/');
          const title = testCase.method || testCase.name.split('.').pop();
          const run_time = parseFloat(time) * 1000;

          tests.push({
            create: true,
            stack,
            message,
            file,
            status,
            title,
            suite_title,
            run_time,
            retry: false,
          });
        });
      });
    });

    const hasFailures = tests.filter(t => t.status === STATUS.FAILED).length > 0;
    const status = hasFailures ? STATUS.FAILED : STATUS.PASSED;

    this.tests = tests;

    debug(tests);

    return {
      status,
      create_tests: true,
      name: 'xUnit',
      tests_count: tests.length,
      passed_count: tests.filter(t => t.status === STATUS.PASSED).length,
      failed_count: tests.filter(t => t.status === STATUS.FAILED).length,
      skipped_count: tests.filter(t => t.status === STATUS.SKIPPED).length,
      tests,
    };
  }

  calculateStats() {
    this.stats = {
      ...this.stats,
      detach: this.requestParams.detach,
      status: 'passed',
      create_tests: true,
      tests_count: 0,
      passed_count: 0,
      failed_count: 0,
      skipped_count: 0,
    };
    this.tests.forEach(t => {
      this.stats.tests_count++;
      if (t.status === 'passed') this.stats.passed_count++;
      if (t.status === 'failed') this.stats.failed_count++;
    });
    if (this.stats.failed_count) this.stats.status = 'failed';

    return this.stats;
  }

  fetchSourceCode() {
    this.tests.forEach(t => {
      try {
        const file = this.adapter.getFilePath(t);
        if (!file) return;

        if (!this.stats.language) {
          if (file.endsWith('.php')) this.stats.language = 'php';
          if (file.endsWith('.py')) this.stats.language = 'python';
          if (file.endsWith('.java')) this.stats.language = 'java';
          if (file.endsWith('.rb')) this.stats.language = 'ruby';
          if (file.endsWith('.js')) this.stats.language = 'js';
          if (file.endsWith('.ts')) this.stats.language = 'ts';
          if (file.endsWith('.cs')) this.stats.language = 'csharp';
        }

        if (!fs.existsSync(file)) {
          debug('Failed to open file with the source code', file);
          return;
        }
        const contents = fs.readFileSync(file).toString();
        t.code = fetchSourceCode(contents, { ...t, lang: this.stats.language });
        if (t.code) debug('Fetched code for test %s', t.title);
        t.test_id = fetchIdFromCode(t.code, { lang: this.stats.language });
        if (t.test_id) debug('Fetched test id %s for test %s', t.test_id, t.title);
      } catch (err) {
        debug(err);
      }
    });
  }

  formatTests() {
    this.tests.forEach(t => {
      if (t.file) {
        t.file = t.file.replace(process.cwd() + path.sep, '');
      }

      this.adapter.formatTest(t);

      t.title = humanize(t.title);
    });
  }

  formatErrors() {
    this.tests
      .filter(t => !!t.stack)
      .forEach(t => {
        t.stack = this.formatStack(t);
        t.message = this.adapter.formatMessage(t);
      });
  }

  formatStack(t) {
    const stack = this.adapter.formatStack(t);

    const sourcePart = fetchSourceCodeFromStackTrace(stack);

    if (!sourcePart) return stack;

    const separator = pc.bold(pc.red('################[ Failure ]################'));

    return `${stack}\n\n${separator}\n${fetchSourceCodeFromStackTrace(stack)}`;
  }

  async uploadArtifacts() {
    for (const test of this.tests.filter(t => !!t.stack)) {
      let files = [];
      if (!test.files?.length) continue;

      files = test.files.map(f => (path.isAbsolute(f) ? f : path.join(process.cwd(), f)));

      if (!files.length) continue;

      const runId = this.runId || this.store.runId || Date.now().toString();
      test.artifacts = await Promise.all(files.map(f => this.uploader.uploadFileByPath(f, [runId, path.basename(f)])));
      console.log(APP_PREFIX, `🗄️ Uploaded ${pc.bold(`${files.length} artifacts`)} for test ${test.title}`);
    }
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

  async uploadData() {
    await this.uploadArtifacts();
    this.calculateStats();
    this.connectAdapter();
    this.fetchSourceCode();
    this.formatErrors();
    this.formatTests();

    const dataString = {
      ...this.stats,
      api_key: this.requestParams.apiKey,
      status: 'finished',
      duration: this.stats.duration,
      tests: this.tests,
    };

    debug('Uploading data', dataString);

    this.pipes = this.pipes || (await this.pipesPromise);
    return Promise.all(this.pipes.map(p => p.finishRun(dataString)));
  }

  async _finishRun() {
    this.pipes = this.pipes || (await this.pipesPromise);
    return Promise.all(this.pipes.map(p => p.finishRun({ status: 'finished' })));
  }
}

export default XmlReader;

function reduceTestCases(prev, item) {
  let testCases = item.testcase;
  if (!testCases) testCases = item['test-case'];
  if (!Array.isArray(testCases)) {
    testCases = [testCases];
  }

  // suite inside test case
  const testCase = item['test-suite']?.['test-case'];
  if (testCase) {
    const nestedCases = Array.isArray(testCase) ? testCase : [testCase];
    testCases.push(...nestedCases);
  }

  const suiteOutput = item['system-out'] || item.output || item.log || '';
  const suiteErr = item['system-err'] || item.output || item.log || '';
  testCases
    .filter(t => !!t)
    .forEach(testCaseItem => {
      const file = testCaseItem.file || item.filepath || item.fullname || item.package || '';

      let stack = '';
      let message = '';
      if (testCaseItem.error) stack = testCaseItem.error;
      if (testCaseItem.failure) stack = testCaseItem.failure;
      if (testCaseItem?.failure?.['stack-trace']) stack = testCaseItem.failure['stack-trace'];
      if (testCaseItem?.failure?.message) message = testCaseItem.failure.message;
      if (testCaseItem?.error?.message) message = testCaseItem.error.message;

      if (testCaseItem.failure && testCaseItem.failure['#text']) stack = testCaseItem.failure['#text'];
      if (testCaseItem.error && testCaseItem.error['#text']) stack = testCaseItem.error['#text'];
      if (!message) message = stack.trim().split('\n')[0];

      const isParametrized = item.type === 'ParameterizedMethod';
      const preferClassname = reduceOptions.preferClassname || isParametrized;

      // SpecFlow config
      let { title, tags, testId } = fetchProperties(isParametrized ? item : testCaseItem);
      let example = null;
      const suiteTitle = preferClassname ? testCaseItem.classname : item.name || testCaseItem.classname;

      title ||= testCaseItem.name || testCaseItem.methodname || testCaseItem.classname;
      tags ||= [];

      const exampleMatches = testCaseItem.name?.match(/\S\((.*?)\)/);
      if (exampleMatches) {
        example = { ...exampleMatches[1].split(',').map(v => v.trim().replace(/[^\w\s-]/g, '')) };
        title = title.replace(/\(.*?\)/, '').trim();
      }

      stack = `${
        testCaseItem['system-out'] || testCaseItem.output || testCaseItem.log || ''
      }\n\n${stack}\n\n${suiteOutput}\n\n${suiteErr}`.trim();

      if (!testId) testId = fetchIdFromOutput(stack);

      if (tags?.length && !testId) {
        testId = tags
          .filter(t => t.startsWith('T'))
          .map(t => `@${t}`)
          .find(t => t.match(TEST_ID_REGEX))
          ?.slice(2);
      }

      let status = STATUS.PASSED.toString();
      if ('failure' in testCaseItem || 'error' in testCaseItem) status = STATUS.FAILED;
      if ('skipped' in testCaseItem) status = STATUS.SKIPPED;
      if (testCaseItem.result && Object.values(STATUS).includes(testCaseItem.result.toLowerCase())) {
        status = testCaseItem.result.toLowerCase();
      }

      let rid = null;
      if (testCaseItem.id) rid = `${ridRunId}-${testCaseItem.id}`;

      // Extract attachments
      let files = [];
      if (testCaseItem.attachments) {
        const attachments = Array.isArray(testCaseItem.attachments.attachment)
          ? testCaseItem.attachments.attachment
          : [testCaseItem.attachments.attachment];

        files = attachments.filter(a => a && a.filePath).map(a => a.filePath);
      }

      // Extract files from stack trace using existing utility
      const stackFiles = fetchFilesFromStackTrace(stack);
      files = [...new Set([...files, ...stackFiles])]; // Remove duplicates

      prev.push({
        rid,
        file,
        stack,
        example,
        tags,
        create: true,
        test_id: testId,
        message,
        line: testCaseItem.lineno,
        // seconds are used in junit reports, but ms are used by testomatio
        run_time: parseFloat(testCaseItem.time || testCaseItem.duration) * 1000,
        status,
        title,
        root_suite_id: TESTOMATIO_SUITE,
        suite_title: suiteTitle,
        files,
        retry: false,
      });
    });
  return prev;
}

function processTestSuite(testsuite) {
  if (!testsuite) return [];
  if (testsuite.testsuite) return processTestSuite(testsuite.testsuite);
  if (testsuite['test-suite'] && !testsuite['test-case']) return processTestSuite(testsuite['test-suite']);

  let suites = testsuite;
  if (!Array.isArray(testsuite)) {
    suites = [testsuite];
  }

  const subSuites = suites.filter(s => s['test-suite'] && !testsuite['test-case']);

  return [...subSuites.map(s => processTestSuite(s['test-suite'])), ...suites.reduce(reduceTestCases, [])].flat();
}

function fetchProperties(item) {
  const tags = [];
  let title = '';

  if (!item.properties) return {};

  // Handle both single property and array of properties
  const properties = Array.isArray(item.properties.property)
    ? item.properties.property
    : [item.properties.property].filter(Boolean);

  const prop = properties.find(p => p.name === 'Description');
  if (prop) title = prop.value;

  let testId = properties.find(p => p.name === 'ID')?.value;

  if (testId?.startsWith('@')) testId = testId.slice(1);
  if (testId?.startsWith('T')) testId = testId.slice(1);

  properties.filter(p => p.name === 'Category').forEach(p => tags.push(p.value));

  return { title, tags, testId };
}
