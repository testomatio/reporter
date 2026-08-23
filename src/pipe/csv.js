import createDebugMessages from 'debug';
import path from 'path';
import fs from 'fs';
import { createObjectCsvWriter } from 'csv-writer';
import pc from 'picocolors';
import merge from 'lodash.merge';
import { isSameTest, getCurrentDateTime, ansiRegExp } from '../utils/utils.js';
import { CSV_HEADERS } from '../constants.js';
import { log } from '../utils/log.js';

const debug = createDebugMessages('@testomatio/reporter:pipe:csv');
/**
 * @typedef {import('../../types/types.js').Pipe} Pipe
 * @typedef {import('../../types/types.js').TestData} TestData
 * @class CsvPipe
 * @implements {Pipe}
 */
class CsvPipe {
  constructor(params, store) {
    this.store = store || {};
    this.title = params.title || process.env.TESTOMATIO_TITLE;
    this.results = [];

    this.outputDir = params.reportDir || 'export';
    if (process.env.TESTOMATIO_RUNGROUP_TITLE) {
      this.outputDir = path.join(this.outputDir, process.env.TESTOMATIO_RUNGROUP_TITLE);
    }
    this.defaultReportName = 'report.csv';
    this.csvFilename = resolveCsvFilename(params);
    this.isEnabled = false;

    if (this.csvFilename) {
      const filenameParts = this.csvFilename.split('.');

      if (filenameParts.length > 0) {
        this.isEnabled = true;
        const baseFilename = filenameParts[0];
        const defaultOutputFile = path.resolve(process.cwd(), this.outputDir, this.defaultReportName);

        const outputFile =
          baseFilename === this.defaultReportName.split('.')[0] // = 'report'
            ? defaultOutputFile
            : path.resolve(process.cwd(), this.outputDir, `${getCurrentDateTime()}_${baseFilename}.csv`);

        this.outputFile = outputFile;
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
      return fs.mkdirSync(this.outputDir, { recursive: true });
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
      log.warn(pc.yellow(`⚠️  CSV file is not set, ignoring`));
      return;
    }

    log.info(pc.yellow(`⏳ The test results will be added to the csv. It will take some time...`));

    try {
      // Create csv writer object
      const writer = createObjectCsvWriter({
        path: this.outputFile,
        header: headers,
      });
      // Save csv file based on the current data
      return await writer.writeRecords(data);
    } catch (e) {
      log.error('Unknown csv error: ', e);
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
      message: message.replace(ansiRegExp(), ''),
      stack: stack.replace(ansiRegExp(), ''),
    });
  }

  /**
   * @param {{ tests?: TestData[] }} runParams
   * @returns {Promise<void>}
   */
  async finishRun(runParams) {
    if (!this.isEnabled) return;

    if (runParams.tests) runParams.tests.forEach(t => this.addTest(t));
    await this.sync();
  }

  async sync() {
    // Save results based on the default headers
    if (this.isEnabled) {
      await this.saveToCsv(this.results, CSV_HEADERS);
      log.info(pc.green(`🗃️  Recording completed! You can check the result in file = ${this.outputFile}`));
    }
  }

  toString() {
    return 'csv exporter';
  }
}

export default CsvPipe;

function resolveCsvFilename(params = {}) {
  if (typeof params.csvFilename === 'string' && params.csvFilename.trim()) {
    return params.csvFilename;
  }

  if (typeof process.env.TESTOMATIO_CSV_FILENAME === 'string' && process.env.TESTOMATIO_CSV_FILENAME.trim()) {
    return process.env.TESTOMATIO_CSV_FILENAME;
  }

  if (params.csv) return 'report.csv';

  return null;
}
