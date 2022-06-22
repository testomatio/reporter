const path = require("path");
const axios = require('axios');
const chalk = require('chalk');
const fs = require("fs");

// const util = require("util"); // you can see a result
const { XMLParser } = require("fast-xml-parser");
const { APP_PREFIX } = require('./constants');
const { isValidUrl, fetchFilesFromStackTrace, fetchSourceCode, fetchSourceCodeFromStackTrace } = require('./util');
const upload = require('./fileUploader');

const Adapter = require('./junit-adapter/adapter');
const JavaScriptAdapter = require('./junit-adapter/javascript');
const JavaAdapter = require('./junit-adapter/java');
const PythonAdapter = require('./junit-adapter/python');
const RubyAdapter = require('./junit-adapter/ruby');

const TESTOMATIO_URL = process.env.TESTOMATIO_URL || "https://app.testomat.io";
const TESTOMATIO = process.env.TESTOMATIO; // key?
const { TESTOMATIO_RUNGROUP_TITLE, TESTOMATIO_TITLE, TESTOMATIO_ENV, TESTOMATIO_RUN } = process.env;

const options = {
  ignoreDeclaration: true,
  ignoreAttributes: false,
  alwaysCreateTextNode: false,
  attributeNamePrefix: "",
  parseTagValue: true,
};

class XmlReader {
  
  constructor(opts = {}) {
    this.requestParams = {
      apiKey: opts.apiKey || TESTOMATIO,
      url: opts.url || TESTOMATIO_URL,
      title: TESTOMATIO_TITLE,
      env: TESTOMATIO_ENV,
      group_title: TESTOMATIO_RUNGROUP_TITLE,
    };
    this.runId = opts.runId || TESTOMATIO_RUN;
    this.adapter = new Adapter(opts)
    this.opts = opts;
    this.axios = axios.create();
    this.parser = new XMLParser(options);
    this.tests = []
    this.stats = {}
    this.stats.language = opts.lang?.toLowerCase();
    this.filesToUpload = {}
  }

  connectAdapter() {
    if (this.opts.javaTests || this.stats.language === 'java') {
      this.adapter = new JavaAdapter(this.opts);
    }
    if (this.stats.language === 'js') {
      this.adapter = new JavaScriptAdapter(this.opts);
    }
    if (this.stats.language === 'python') {
      this.adapter = new PythonAdapter(this.opts);
    }
    if (this.stats.language === 'ruby') {
      this.adapter = new RubyAdapter(this.opts);
    }
  }

  parse(fileName) {       
    const xmlData = fs.readFileSync(path.resolve(fileName));
    const jsonResult = this.parser.parse(xmlData);
    let jsonSuite;

    if (jsonResult.testsuites) {
      jsonSuite = jsonResult.testsuites;
    } else if (jsonResult.testsuite) {
      jsonSuite = jsonResult;
    } else {
      console.log(jsonResult)
      throw new Error("Format can't be parsed")
    }
    const { testsuite, name, tests, failures, errors } = jsonSuite;

    const resultTests = processTestSuite(testsuite);
    
    const hasFailures = resultTests.filter(t => t.status === 'failed').length > 0;
    const status = ( failures > 0 || errors > 0 || hasFailures) ? 'failed' : 'passed';

    this.tests = this.tests.concat(resultTests);

    return {
      status,
      create_tests: true,
      name,
      tests_count: parseInt(tests, 10),
      passed_count: parseInt(tests - failures, 10),
      failed_count: parseInt(failures, 10),
      skipped_count: 0,
      tests: resultTests,
    };
  }

  calculateStats() {
    this.stats = {
      ...this.stats,
      status: 'passed',
      create_tests: true,
      tests_count: 0,
      passed_count: 0,
      failed_count: 0,
      skipped_count: 0,
    }
    this.tests.forEach(t => {
      this.stats.tests_count++;
      if (t.status === 'passed') this.stats.passed_count++;
      if (t.status === 'failed') this.stats.failed_count++;
    })
    if (this.stats.failed_count) this.stats.status = 'failed';

    return this.stats;
  }

  fetchSourceCode() {
    this.tests.forEach(t => {
      try {
        const file = this.adapter.getFilePath(t)
        if (!file) return;

        if (!this.stats.language) {
          if (file.endsWith('.php')) this.stats.language = 'php';
          if (file.endsWith('.py')) this.stats.language = 'python';
          if (file.endsWith('.java')) this.stats.language = 'java';
          if (file.endsWith('.rb')) this.stats.language = 'ruby';
          if (file.endsWith('.js')) this.stats.language  = 'js';
          if (file.endsWith('.ts')) this.stats.language = 'ts';
        }

        const contents = fs.readFileSync(file).toString();
        t.code = fetchSourceCode(contents, { ...t, lang: this.stats.language })
      } catch (err) {
        if (process.env.DEBUG) {
            console.log(err)
        }
      }
    });
  }

  formatTests() {
    this.tests.forEach(t => {
      if (t.file) {
        t.file = t.file.replace(process.cwd() + path.sep, '')
      }

      this.adapter.formatTest(t)

      t.title = t.title
      // insert a space before all caps
        .replace(/([A-Z])/g, ' $1')
      // _ chars to spaces
        .replace(/_/g, ' ')
      // uppercase the first character
        .replace(/^(.)|\s(.)/g, $1 => $1.toLowerCase())

        // remove standard prefixes
        .replace(/^test\s/, '')
        .replace(/^should\s/, '')
    });
  }

  formatErrors() {
    this.tests.filter(t => !!t.stack).forEach(t => {
      t.stack = this.formatStack(t)
      t.message = this.adapter.formatMessage(t);
    });

  }

  formatStack(t) {
    const stack = this.adapter.formatStack(t);

    const sourcePart = fetchSourceCodeFromStackTrace(stack);

    if (!sourcePart) return stack;

    const separator = chalk.bold.red('################[ Failure ]################');

    return `${stack}\n\n${separator}\n${fetchSourceCodeFromStackTrace(stack)}`;
  }

  async uploadArtifacts() {
    if (!this.runId) return;
    for (const test of this.tests.filter(t => !!t.stack)) {
      const files = fetchFilesFromStackTrace(test.stack);
      test.artifacts = await Promise.all(files.map(f => upload.uploadFileByPath(f, this.runId)));
    }
  }

  async createRun() {
    if (this.runId) return;

    const runParams = {
      api_key: this.requestParams.apiKey,
      title: this.requestParams.title,
      env: this.requestParams.env,
      group_title: this.requestParams.group_title,
    };    

    try {
      const resp = await this.axios.post(this.url, runParams, {
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        headers: {
          // Overwrite Axios's automatically set Content-Type
          'Content-Type': 'application/json',
        }
      });
      if (resp.status >= 400) {
        const data = resp.data || { message: '' };
        console.log(
          APP_PREFIX,
          `Report couldn't be processed: (${resp.status}) ${data.message}`,
        );
        return;
      }
      this.runId = resp.data.uid;
      this.runUrl = `${TESTOMATIO_URL}/${resp.data.url.split('/').splice(3).join('/')}`;
    } catch(err) {
      if (process.env.DEBUG) console.log(err)
      const data = err?.response?.data || { message: '' };
      console.log(APP_PREFIX, 'Error creating run, skipping...', err?.response?.statusText, data);
    }
  }

  async uploadData() {
    await this.uploadArtifacts();
    this.calculateStats();
    this.connectAdapter();
    this.fetchSourceCode();
    this.formatErrors();
    this.formatTests();

    if (process.env.DEBUG) {
      console.log({
        ...this.stats,
        tests: this.tests,
      })
    }

    const dataString = JSON.stringify({
      ...this.stats,
      api_key: this.requestParams.apiKey,
      tests: this.tests,
    });

    try {
      const resp = await this.axios.put(`${this.url}/${this.runId}`, dataString, {
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        headers: {
          // Overwrite Axios's automatically set Content-Type
          'Content-Type': 'application/json',
        }
      });

      if (resp.status >= 400) {
        const data = resp.data || { message: '' };
        console.log(
          APP_PREFIX,
          `Report couldn't be processed: (${resp.status}) ${data.message}`,
        );
        return;
      }

      if (this.runUrl) {
        console.log(APP_PREFIX, '📊 Report Saved. Report URL:', chalk.magenta(this.runUrl));
      }
      process.env.runId = this.runId;
      return resp;
    } catch (err) {
      // if (process.env.DEBUG) console.log(err.response)
      const data = err.response.data || { message: '' };
      console.log(APP_PREFIX, 'Error uploading, skipping...', err.response.statusText, data);
      return err.response;
    }

  }

  get url() {
    if (!isValidUrl(this.requestParams.url)) {
      console.log(
        APP_PREFIX,
        chalk.red(`Error creating report on Testomat.io, report url '${this.requestParams.url}' is invalid`),
      );
      return;
    }

    return `${this.requestParams.url}/api/reporter`;
  }
}

module.exports = XmlReader;


function reduceTestCases(prev, item) {
  let testCases = item.testcase;
  if (!Array.isArray(testCases)) {
    testCases = [testCases]
  }
  testCases.filter(t => !!t).forEach(testCaseItem => {
    const file = testCaseItem.file || item.filepath || '';

    let stack = '';
    let message = '';
    if (testCaseItem.error) stack = testCaseItem.error;
    if (testCaseItem.failure) stack = testCaseItem.failure;
    if (testCaseItem?.failure?.message) message = testCaseItem.failure.message;
    if (testCaseItem?.error?.message) message = testCaseItem.error.message;

    if (testCaseItem.failure && testCaseItem.failure['#text']) stack = testCaseItem.failure['#text'];
    if (testCaseItem.error && testCaseItem.error['#text']) stack = testCaseItem.error['#text'];
    if (!message) message = stack.trim().split('\n')[0];

    // prepend system output
    stack = `${testCaseItem['system-out'] || testCaseItem.log || ''}\n\n${stack}`.trim()

    prev.push({
      create: true,
      file,
      stack,
      message,
      line: testCaseItem.lineno,
      run_time: testCaseItem.time,
      status: (testCaseItem.failure || testCaseItem.error) ? 'failed' : 'passed',
      title: testCaseItem.name,
      suite_title: testCaseItem.classname || item.name,
    })
  });
  return prev;
}

function processTestSuite(testsuite) {
  if (testsuite.testsuite) return processTestSuite(testsuite.testsuite)

  let suites = testsuite;
  if (!Array.isArray(testsuite)) {
    suites = [testsuite];
  }

  const res = suites.reduce(reduceTestCases, []);

  return res;
}

