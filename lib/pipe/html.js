const debug = require('debug')('@testomatio/reporter:pipe:html');
const merge = require('lodash.merge');
const { isSameTest, getCurrentDateTime } = require('../util');

const HTML_REPORT_DEFAULT_NAME = "testomatio-report.html";  //TODO: move to constant

class HtmlPipe {
    constructor(params, store = {}) {
        this.store = store || {};
        this.title = params.title || process.env.TESTOMATIO_TITLE;
        this.results = [];

        // this.outputDir = 'export'; - TODO: save as a new folder MAYBE!!!
        this.htmlReportName = process.env.TESTOMATIO_HTML_FILENAME || HTML_REPORT_DEFAULT_NAME;
        this.isEnabled = !!this.htmlReportName
        this.isHtmlSave = false;

        // ifisHtmlSave (this.htmlReportName) {
        //TODO: some code
        // }        
    }

    async createRun() {
        // empty
    }

    updateRun() { }

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

    async finishRun(runParams) {
        if (!this.isEnabled) return;

        if (runParams.tests) runParams.tests.forEach(t => this.addTest(t));
        // Save results based on the default headers
        if (this.isHtmlSave) {
            this.buildReport(this.results);
        }
    }

    buildReport(data) {
    //      //some code TODO: => as part of _addDataFile(fileName, data)
    }

    // _addSuiteToReport(suite) {
    //     //some code TODO:
    // }

    // _addTestToReport(test) {
    //     //some code TODO:
    // }

    toString() {
        return 'HTML Reporter';
    }
}