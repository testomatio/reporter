"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const debug_1 = __importDefault(require("debug"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const csv_writer_1 = require("csv-writer");
const picocolors_1 = __importDefault(require("picocolors"));
const lodash_merge_1 = __importDefault(require("lodash.merge"));
const utils_js_1 = require("../utils/utils.js");
const constants_js_1 = require("../constants.js");
const debug = (0, debug_1.default)('@testomatio/reporter:pipe:csv');
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
        this.outputDir = 'export';
        this.defaultReportName = 'report.csv';
        this.csvFilename = process.env.TESTOMATIO_CSV_FILENAME;
        this.isEnabled = false;
        if (this.csvFilename) {
            const filenameParts = this.csvFilename.split('.');
            if (filenameParts.length > 0) {
                this.isEnabled = true;
                const baseFilename = filenameParts[0];
                const defaultOutputFile = path_1.default.resolve(process.cwd(), this.outputDir, this.defaultReportName);
                const outputFile = baseFilename === this.defaultReportName.split('.')[0] // = 'report'
                    ? defaultOutputFile
                    : path_1.default.resolve(process.cwd(), this.outputDir, `${(0, utils_js_1.getCurrentDateTime)()}_${baseFilename}.csv`);
                this.outputFile = outputFile;
            }
        }
    }
    // TODO: to using SET opts as argument => prepareRun(opts)
    async prepareRun() { }
    async createRun() {
        // empty
    }
    updateRun() { }
    /**
     * Create a folder that will contain the exported files
     */
    checkExportDir() {
        if (!fs_1.default.existsSync(this.outputDir)) {
            return fs_1.default.mkdirSync(this.outputDir);
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
            console.log(picocolors_1.default.yellow(`⚠️  CSV file is not set, ignoring`));
            return;
        }
        console.log(picocolors_1.default.yellow(`⏳ The test results will be added to the csv. It will take some time...`));
        try {
            // Create csv writer object
            const writer = (0, csv_writer_1.createObjectCsvWriter)({
                path: this.outputFile,
                header: headers,
            });
            // Save csv file based on the current data
            return await writer.writeRecords(data);
        }
        catch (e) {
            console.log('Unknown csv error: ', e);
        }
    }
    /**
     * Add test data to the result array for saving. As a result of this function, we get a result object to save.
     * @param {Object} test - object which includes each test entry.
     */
    addTest(test) {
        if (!this.isEnabled)
            return;
        const index = this.results.findIndex(t => (0, utils_js_1.isSameTest)(t, test));
        // update if they were already added
        if (index >= 0) {
            this.results[index] = (0, lodash_merge_1.default)(this.results[index], test);
            return;
        }
        const { suite_title, title, status, message, stack } = test;
        this.results.push({
            suite_title,
            title,
            status,
            message: message.replace((0, utils_js_1.ansiRegExp)(), ''),
            stack: stack.replace((0, utils_js_1.ansiRegExp)(), ''),
        });
    }
    /**
     * @param {{ tests?: TestData[] }} runParams
     * @returns {Promise<void>}
     */
    async finishRun(runParams) {
        if (!this.isEnabled)
            return;
        if (runParams.tests)
            runParams.tests.forEach(t => this.addTest(t));
        // Save results based on the default headers
        if (this.isEnabled) {
            await this.saveToCsv(this.results, constants_js_1.CSV_HEADERS);
            console.log(picocolors_1.default.green(`🗃️  Recording completed! You can check the result in file = ${this.outputFile}`));
        }
    }
    toString() {
        return 'csv exporter';
    }
}
module.exports = CsvPipe;
