const debug = require('debug')('@testomatio/reporter:pipe:html');
const merge = require('lodash.merge');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const handlebars = require('handlebars');

const { fileSystem, isSameTest } = require('../util');

const { HTML_REPORT } = require('../constants');
class HtmlPipe {
    constructor(params, store = {}) {
        this.store = store || {};
        this.title = params.title || process.env.TESTOMATIO_TITLE;
        this.apiKey = params.apiKey || process.env.TESTOMATIO;
        this.isHtml = process.env.TESTOMATIO_HTML_REPORT_SAVE;
        this.data = {};

        debug('HTML Pipe: ', this.apiKey ? 'API KEY' : '*no api key*');
        if (!this.apiKey) {
            return;
        }

        this.isEnabled = false;
        this.htmlOutputPath = "";
        this.tests = [];
        this.data = {};

        if (this.isHtml) {
            this.isEnabled = true;
            this.htmlReportDir = process.env.TESTOMATIO_HTML_REPORT_FOLDER || HTML_REPORT.FOLDER;

            if (process.env.TESTOMATIO_HTML_FILENAME && process.env.TESTOMATIO_HTML_FILENAME.endsWith(".html")) {
                this.htmlReportName = process.env.TESTOMATIO_HTML_FILENAME
            }

            if (process.env.TESTOMATIO_HTML_FILENAME && !process.env.TESTOMATIO_HTML_FILENAME.endsWith(".html")) {
                console.log(chalk.blue(`The name must include the extension ".html". The default report name is used!`));
                this.htmlReportName = HTML_REPORT.REPORT_DEFAULT_NAME;
            }

            if (!process.env.TESTOMATIO_HTML_FILENAME) {
                this.htmlReportName = HTML_REPORT.REPORT_DEFAULT_NAME;
            }

            this.templateFolderPath = path.resolve(__dirname, '..', 'template');
            this.templateHtmlPath = path.resolve(this.templateFolderPath, HTML_REPORT.TEMPLATE_NAME);
            this.htmlOutputPath = path.join(this.htmlReportDir, this.htmlReportName);
            //create a new folder for the HTML reports
            fileSystem.createDir(this.htmlReportDir);

            debug(
                chalk.yellow('HTML Pipe:'),
                `Save HTML report: ${this.isEnabled}`,
                `HTML report folder: ${this.htmlReportDir}, report name: ${this.htmlReportName}`
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
     * @param {Object} test - object which includes each test entry.
     */
    addTest(test) {
        if (!this.isEnabled) return;

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
            this.data =
                Object.assign({
                    runId: this.store.runId,
                    status: runParams.status,
                    parallel: runParams.isParallel,
                    runUrl: this.store.runUrl,
                    executionTime: testExecutionSumTime(this.tests),
                    executionDate: getCurrentDateTimeFormatted()
                },
                {
                    tests: this.tests
                });

            // GENERATE HTML reports based on the results data
            this.buildReport(this.data);
        }
    }

    buildReport(data) {
        debug('HTML tests data:', data);

        if (!this.htmlOutputPath && this.htmlOutputPath !== "") {
            console.log(chalk.yellow(`HTML export path is not set, ignoring...`));
            return;
        }

        console.log(chalk.yellow(`The test results will be added to the HTML report. It will take some time...`));
        // generate output HTML based on the template
        const html = this.#generateHTMLReport(data);

        fs.writeFileSync(this.htmlOutputPath, html, 'utf-8');
    }

    #generateHTMLReport(data) {
        if (!this.templateHtmlPath) {
            console.log(chalk.red(`HTML template not found. Report generation is impossible!`))
            return;
        }

        const templateSource = fs.readFileSync(this.templateHtmlPath, 'utf8');
        this.#loadReportHelpers();
        try {
            const template = handlebars.compile(templateSource);

            console.log(chalk.green(`Generated HTML report saved in file: ${this.htmlOutputPath}`));
            return template(data);
        }
        catch (e) {
            console.log('Unknown HTML report generation error: ', e);
        }
    }

    #loadReportHelpers() {
        handlebars.registerHelper('getTestsByStatus', function (tests, status) {
            return tests.filter(test => test.status.toLowerCase() === status.toLowerCase()).length;
        });

        handlebars.registerHelper('json', function (obj) {
            return JSON.stringify(obj);
        });
    }

    toString() {
        return 'HTML Reporter';
    }
}

function testExecutionSumTime(tests) {
    const totalMilliseconds = tests.reduce((sum, test) => {
        if (typeof test.run_time === 'number') {
            return sum + test.run_time;
        }
        return sum;
    }, 0);

    return formatDuration(totalMilliseconds);
}

function formatDuration(duration) {
    const milliseconds = duration % 1000;
    duration = (duration - milliseconds) / 1000;
    const seconds = duration % 60;
    duration = (duration - seconds) / 60;
    const minutes = duration % 60;
    const hours = (duration - minutes) / 60;

    return `${hours}h ${minutes}m ${seconds}s ${milliseconds}ms`;
}

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