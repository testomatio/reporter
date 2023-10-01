const debug = require('debug')('@testomatio/reporter:pipe:html');
const merge = require('lodash.merge');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const handlebars = require('handlebars');
const { isSameTest, getCurrentDateTime } = require('../util');

const HTML_REPORT_DEFAULT_NAME = "testomatio-report.html";  //TODO: move to constant
const HTML_REPORT_FOLDER = "html-report";
const {result} = require('./data');

class HtmlPipe {
    constructor(params, store = {}) {
        this.store = store || {};
        // this.title = params.title || process.env.TESTOMATIO_TITLE;
        this.results = [];

        // this.outputDir = 'export'; - TODO: save as a new folder MAYBE!!!
        this.htmlExportDir = process.env.TESTOMATIO_HTML_REPORT_FOLDER || HTML_REPORT_FOLDER;
        this.htmlReportName = process.env.TESTOMATIO_HTML_FILENAME || HTML_REPORT_DEFAULT_NAME;
        this.isEnabled = !!this.htmlReportName
        this.isHtmlSave = false;
        this.htmlExportPath = ""; // ??TODO: test this condition

        // this.htmlExportPath = path.resolve(process.cwd(), this.htmlExportDir, this.htmlReportName); ??TODO: test this condition
        // if (this.isHtmlSave && this.htmlReportName) {
        // //TODO: some code => update condition using various params=default/no default
        //     this.htmlExportPath = path.resolve(process.cwd(), this.htmlExportDir, this.htmlReportName);
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
        debug('HTML tests data', data);
        //some code TODO: => as part of _addDataFile(fileName, data)
        const outputFileName = 'test-1.html';

        if (!fs.existsSync(this.htmlExportDir)) {
            return fs.mkdirSync(this.htmlExportDir);
        }

        const htmlExportPath = path.resolve(process.cwd(), this.htmlExportDir, outputFileName);

        if (!htmlExportPath) {
            console.log(this, chalk.yellow(`HTML export path is not set, ignoring...`));
            return;
        }

        console.log(this, chalk.yellow(`The test results will be added to the HTML report. It will take some time...`));
        
        const html = this._generateHTMLReport(data);

        fs.writeFileSync(htmlExportPath, html, 'utf-8');
        console.log(`Згенерований HTML репорт збережено у файлі: ${outputFileName}`);
    }
    

    _generateHTMLReport(data) {
        const templatePath = path.resolve(__dirname, 'template.hbs');
        const templateSource = fs.readFileSync(templatePath, 'utf8');

        this._loadReportHelpers();
        const template = handlebars.compile(templateSource);

        return template(data);
    }

    _loadReportHelpers() {
        handlebars.registerHelper('calculateDuration', function (start, end) {
            const startTime = new Date('1970-01-01T' + start + 'Z');
            const endTime = new Date('1970-01-01T' + end + 'Z');

            const durationInMilliseconds = endTime - startTime;
            
            const hours = Math.floor(durationInMilliseconds / 3600000);
            const minutes = Math.floor((durationInMilliseconds % 3600000) / 60000);
            const seconds = Math.floor((durationInMilliseconds % 60000) / 1000);

            const durationString = `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;

            return durationString;
        });

        handlebars.registerHelper('getTestsByStatus', function (tests, status) {
            return tests.filter(test => test.status.toLowerCase() === status.toLowerCase()).length;
        });
          
        handlebars.registerHelper('eq', function (a, b, options) {
            return a === b ? options.fn(this) : options.inverse(this);
        });
    }
    _specFileToReport(path) {
        //some code => as in PLaywright report - by spec files
        //TODO: Чи треба додавати Тест Степи як у Плею, чи поки можна копіювати репорт з клієнту без нього?
        // + Кол з Сашею, як мені сейвити результати в папку самого Фреймворку, можливо винести все в атомарне рішення????
    }
    _suitesToReport(suites) {
         //some code TODO: => map by each availeble sites
        //  if no suites  => map by each available test        
    }

    // _addSuiteToReport(suite) {
         //some code => cheack if at least one suite availabel
        // if no - only tests are add
        // inner function
        // _addTestToReport(test)
    // }

    // _addTestToReport(test) {
    //     //some code => get RUN tests and iterate one by one add to suite
    // }

    toString() {
        return 'HTML Reporter';
    }
}

const html = new HtmlPipe({title: "My title"});
html.buildReport(result);