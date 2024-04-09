const debug = require('debug')('@testomatio/reporter:pipe:html');
const merge = require('lodash.merge');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const handlebars = require('handlebars');
const fileUrl = require('file-url');

const { fileSystem, isSameTest, ansiRegExp } = require('../utils/utils');
const { HTML_REPORT } = require('../constants');

class HtmlPipe {
  constructor(params, store = {}) {
    this.store = store || {};
    this.title = params.title || process.env.TESTOMATIO_TITLE;
    this.apiKey = params.apiKey || process.env.TESTOMATIO;
    this.isHtml = process.env.TESTOMATIO_HTML_REPORT_SAVE;

    debug('HTML Pipe: ', this.apiKey ? 'API KEY' : '*no api key provided*');

    this.isEnabled = false;
    this.htmlOutputPath = '';
    this.fullHtmlOutputPath = '';
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
        chalk.yellow('HTML Pipe:'),
        `Save HTML report: ${this.isEnabled}`,
        `HTML report folder: ${this.htmlReportDir}, report name: ${this.htmlReportName}`,
      );
    }
  }

  async createRun() {
    // empty
  }

  updateRun() {
    // empty
  }

  /**
   * Add test data to the result array for saving. As a result of this function, we get a result object to save.
   * @param {import('../../types').RunData} test - object which includes each test entry.
   */
  addTest(test) {
    if (!this.isEnabled) return;

    if (!test.status) return;

    const index = this.tests.findIndex(t => isSameTest(t, test));
    // update if they were already added
    if (index >= 0) {
      this.tests[index] = merge(this.tests[index], test);
      return;
    }

    this.tests.push(test);
  }

  async finishRun(runParams) {
    if (!this.isEnabled) return;

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
      console.log(chalk.yellow(`🚨 HTML export path is not set, ignoring...`));
      return;
    }

    console.log(chalk.yellow(`⏳ The test results will be added to the HTML report. It will take some time...`));

    if (msg) {
      console.log(chalk.blue(msg));
    }

    tests.forEach(test => {
      if (!test.message?.trim()) {
        test.message = "This test has no 'message' code";
      }

      if (!test.suite_title?.trim()) {
        test.suite_title = 'Unknown suite';
      }

      if (!test.title?.trim()) {
        test.title = 'Unknown test title';
      }

      if (!test.files?.length) {
        test.files = 'This test has no files';
      }

      if (!test.steps?.trim()) {
        test.steps = "This test has no 'steps' code";
      } else {
        test.steps = removeAnsiColorCodes(test.steps);
      }

      // TODO: future-proof: currently there is no need to display Artifacts and Metadata in HTML
      test.artifacts = test.artifacts || [];
      test.meta = test.meta || {};
      // TODO: u can added an additional test values to this checks in the future
    });

    const data = {
      runId: this.store.runId || '',
      status: runParams.status || 'No status info',
      parallel: runParams.isParallel || 'No parallel info',
      runUrl: this.store.runUrl || '',
      executionTime: testExecutionSumTime(tests),
      executionDate: getCurrentDateTimeFormatted(),
      tests,
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

      console.log(chalk.green(`📊 The HTML report was successfully generated. Full filepath: ${fileUrlPath}`));
    } else {
      console.log(chalk.red(`🚨 Failed to generate the HTML report.`));
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
      console.log(chalk.red(`🚨 HTML template not found. Report generation is impossible!`));
      return;
    }

    const templateSource = fs.readFileSync(templatePath, 'utf8');
    this.#loadReportHelpers();
    try {
      const template = handlebars.compile(templateSource);

      return template(data);
    } catch (e) {
      console.log(chalk.red('❌ Oops! An unknown error occurred when generating an HTML report'));
      console.log(chalk.red(e));
    }
  }

  #loadReportHelpers() {
    handlebars.registerHelper(
      'getTestsByStatus',
      (tests, status) => tests.filter(test => test.status.toLowerCase() === status.toLowerCase()).length,
    );

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
    /* eslint-disable */
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
    /* eslint-enable */
    handlebars.registerHelper('pageDispleyElements', tests => {
      // We wrapp the lines to the HTML format we need
      const totalTests = JSON.parse(
        JSON.stringify(tests)
          .replace(/<script>/g, '&lt;script&gt;')
          .replace(/<\/script>/g, '&lt;/script&gt;'), // eslint-disable-line
      );

      const paginationOptions = {
        0: 10,
        1: 25,
        2: 50,
      };
      const statuses = ['all', 'passed', 'failed', 'skipped'];
      const pageItemGroups = {
        all: {},
        passed: {},
        failed: {},
        skipped: {},
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
          // eslint-disable-next-line no-prototype-builtins
          if (paginationOptions.hasOwnProperty(option)) {
            const pageSize = paginationOptions[option];
            let filteredItems = totalTests;

            if (status !== 'all') {
              filteredItems = totalTests.filter(item => item.status === status);
            }

            pageItemGroups[status][option] = paginateItems(filteredItems, pageSize);
          }
        }
      });

      pageItemGroups.totalTests = totalTests;

      return JSON.stringify(pageItemGroups);
    });
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

/**
 * Removes ANSI color codes and converts newline characters to HTML line breaks in a given string.
 * @param {string} str - The input string containing ANSI color codes.
 * @returns {string} - The updated string with removed ANSI color codes and replaced newline characters.
 */
function removeAnsiColorCodes(str) {
  let updatedStr = str.replace(ansiRegExp(), '');
  updatedStr = updatedStr.replace(/\n/g, '<br>');

  return updatedStr;
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

module.exports = HtmlPipe;
