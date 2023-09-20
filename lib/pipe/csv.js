const debug = require('debug')('@testomatio/reporter:pipe:csv');
const path = require('path');
const fs = require('fs');
const csvWriter = require('csv-writer');
const chalk = require('chalk');
const merge = require('lodash.merge');
const { isSameTest, getCurrentDateTime } = require('../utils/utils');
const { CSV_HEADERS } = require('../constants');

/**
 * @typedef {import('../../types').Pipe} Pipe
 * @typedef {import('../../types').TestData} TestData
 * @class CsvPipe
 * @implements {Pipe}
 */
class CsvPipe {

  constructor(params, store) {
    this.store = store || {};
    this.title = params.title || process.env.TESTOMATIO_TITLE;
    this.results = [];

    this.outputDir = 'export';
    this.csvFilename = process.env.TESTOMATIO_CSV_FILENAME;
    this.isEnabled = !!this.csvFilename
    this.isCsvSave = false;

    if (this.csvFilename !== undefined && this.csvFilename.split('.').length > 0) {
      this.isCsvSave = true;

      if (this.csvFilename.split('.')[0] === 'report') {
        this.outputFile = path.resolve(process.cwd(), this.outputDir, 'report.csv');
      } else {
        this.outputFile = path.resolve(
          process.cwd(),
          this.outputDir,
          `${getCurrentDateTime()}_${this.csvFilename.split('.')[0]}.csv`,
        );
      }
    }
  }

  // TODO: to using SET opts as argument => prepareRun(opts)
  async prepareRun() {}
  
  async createRun() {
    // empty
  }

  updateRun() {}

  /**
   * Create a folder that will contain the exported files
   */
  checkExportDir() {
    if (!fs.existsSync(this.outputDir)) {
      return fs.mkdirSync(this.outputDir);
    }
  }

  /**
   * Save data to the csv file.
   * @param {Object} data - data that will be added to the CSV file.
   * Example: [{suite_title: "Suite #1", test: "Test-case-1", message: "Test msg"}]
   * @param {Object} headers - csv file headers. Example: [{ id: 'suite_title', title: 'Suite_title' }]
   */
  async saveToCsv(data, headers) {
    debug('Data', data);
    // First, we check whether the export directory exists: if yes - OK, no - create it.
    this.checkExportDir();

    if (!this.outputFile) {
      console.log(this, chalk.yellow(`CSV file is not set, ignoring`));
      return;
    }

    console.log(this, chalk.yellow(`The test results will be added to the csv. It will take some time...`));
    // Create csv writer object
    const writer = csvWriter.createObjectCsvWriter({
      path: this.outputFile,
      header: headers,
    });
    // Save csv file based on the current data
    try {
      await writer.writeRecords(data);
      console.log(this, chalk.green(`Recording completed! You can check the result in file = ${this.outputFile}`));
    } catch (e) {
      console.log('Unknown error: ', e);
    }
  }

  /**
   * Add test data to the result array for saving. As a result of this function, we get a result object to save.
   * @param {Object} test - object which includes each test entry.
   */
  addTest(test) {
    if (!this.isEnabled) return;

    const index = this.results.findIndex(t => isSameTest(t, test));
    // update if they were already added
    if (index >= 0) {
      this.results[index] = merge(this.results[index], test);
      return;
    }

    const { suite_title, title, status, message, stack } = test;

    this.results.push({
      suite_title,
      title,
      status,
      message,
      stack,
    });
  }

  /**
   * @param {{ tests?: TestData[] }} runParams
   * @returns {Promise<void>}
   */
  async finishRun(runParams) {
    if (!this.isEnabled) return;

    if (runParams.tests) runParams.tests.forEach(t => this.addTest(t));
    // Save results based on the default headers
    if (this.isCsvSave) {
      this.saveToCsv(this.results, CSV_HEADERS);
    }
  }

  toString() {
    return 'csv exporter';
  }
}

module.exports = CsvPipe;
