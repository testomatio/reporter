import createDebugMessages from 'debug';
import path from 'path';
import pc from 'picocolors';
import fs from 'fs';
import { XMLParser } from 'fast-xml-parser';
import { APP_PREFIX, STATUS } from './constants.js';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { NUnitXmlParser } from './junit-adapter/nunit-parser.js';
import {
  fetchFilesFromStackTrace,
  fetchIdFromOutput,
  fetchSourceCode,
  fetchSourceCodeFromStackTrace,
  fetchIdFromCode,
  humanize,
  TEST_ID_REGEX,
  transformEnvVarToBoolean,
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
  TESTOMATIO_LEGACY_NUNIT,
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

    // Enhanced NUnit parsing - enabled by default for NUnit XML
    // Can be disabled via opts.enhancedNunit = false or TESTOMATIO_LEGACY_NUNIT=1
    this.enhancedNunit = !transformEnvVarToBoolean(TESTOMATIO_LEGACY_NUNIT);
    this.groupParameterized = opts.groupParameterized !== false; // Default true, can be disabled

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
    const { testsuite, name, failures, errors } = jsonSuite;
    const tests = testsuite?.tests || jsonSuite.tests;

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
    // Use enhanced NUnit parser if enabled and this is actually NUnit XML
    if (this.enhancedNunit && this.isNUnitXml(jsonSuite)) {
      debug('Using enhanced NUnit parser');
      return this.processNUnitEnhanced(jsonSuite);
    }

    // Fallback to legacy parser for backward compatibility
    debug('Using legacy NUnit parser');
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

  /**
   * Check if the XML is actually NUnit format (has test-suite hierarchy)
   * @param {Object} jsonSuite - Parsed XML suite object
   * @returns {boolean} - True if this is NUnit XML format
   */
  isNUnitXml(jsonSuite) {
    // NUnit XML has test-suite elements with type attributes
    if (jsonSuite['test-suite']) {
      const testSuite = Array.isArray(jsonSuite['test-suite']) ? jsonSuite['test-suite'][0] : jsonSuite['test-suite'];

      // Check for NUnit-specific test-suite types
      return (
        testSuite &&
        testSuite.type &&
        ['Assembly', 'TestSuite', 'TestFixture', 'ParameterizedMethod'].includes(testSuite.type)
      );
    }
    return false;
  }

  processNUnitEnhanced(jsonSuite) {
    debug('Processing NUnit XML with enhanced parser');

    try {
      const nunitParser = new NUnitXmlParser({
        groupParameterized: this.groupParameterized,
        ...this.opts,
      });

      const result = nunitParser.parseTestRun(jsonSuite);

      // Add parsed tests to our collection
      this.tests = this.tests.concat(result.tests);

      debug(`Enhanced NUnit parser processed ${result.tests.length} tests`);

      return result;
    } catch (error) {
      debug('Enhanced NUnit parser failed, falling back to legacy parser:', error.message);
      console.warn(`${APP_PREFIX} Enhanced NUnit parsing failed, using legacy parser: ${error.message}`);

      // Fallback to legacy parser
      this.enhancedNunit = false;
      return this.processNUnit(jsonSuite);
    }
  }

  processTRX(jsonSuite) {
    let defs = jsonSuite?.TestRun?.TestDefinitions?.UnitTest;
    if (!Array.isArray(defs)) defs = [defs].filter(d => !!d);

    // Parse test definitions
    const tests = defs.map(td => this._parseTRXTestDefinition(td));

    // Parse test results
    let result = jsonSuite?.TestRun?.Results?.UnitTestResult;
    if (!Array.isArray(result)) result = [result].filter(d => !!d);

    const results = result.map(td => this._parseTRXTestResult(td, tests));

    debug(results);

    const counters = jsonSuite?.TestRun?.ResultSummary?.Counters || {};
    const failed_count = parseInt(counters.failed, 10) + parseInt(counters.error, 10);
    const status = failed_count > 0 ? STATUS.FAILED : STATUS.PASSED.toString();

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

  _parseTRXTestDefinition(td) {
    const title = td.name.replace(/\(.*?\)/, '').trim();
    const exampleMatch = td.name.match(/\((.*?)\)/);
    const example = exampleMatch
      ? {
          ...exampleMatch[1]
            .split(',')
            .map(p => p.trim())
            .filter(p => p !== ''),
        }
      : null;

    const suite = td.TestMethod.className.split(', ')[0].split('.');
    const suite_title = suite.pop();

    // Convert namespace to file path for C#
    const file = `${suite.join('/')}.cs`;

    return {
      title, // Base name without parameters for test import
      example, // Parameters object for parameterized tests
      file, // File path with .cs extension
      description: td.Description,
      suite_title,
      id: td.Execution.id,
    };
  }

  _parseTRXTestResult(td, tests) {
    const test = tests.find(t => t.id === td.executionId) || {};

    const result = {
      suite_title: test.suite_title,
      title: test.title?.trim(),
      file: test.file,
      description: test.description,
      code: test.code,
      run_time: parseFloat(td.duration) * 1000,
      stack: td.Output?.StdOut || '',
      files: td?.ResultFiles?.ResultFile?.map(rf => rf.path),
      create: true,
      overwrite: true,
    };

    // Add example for parameterized tests
    if (test.example) {
      result.example = test.example;
    }

    // Map TRX status to Testomat.io status
    result.status = this._mapTRXStatus(td.outcome);

    return result;
  }

  _mapTRXStatus(outcome) {
    switch (outcome) {
      case 'Passed':
        return STATUS.PASSED;
      case 'Failed':
        return STATUS.FAILED;
      case 'Skipped':
        return STATUS.SKIPPED;
      default:
        return STATUS.PASSED;
    }
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
        example = {
          ...exampleMatches[1]
            .split(',')
            .map(v => v.trim().replace(/[^\w\s-]/g, ''))
            .filter(v => v !== ''),
        };
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
