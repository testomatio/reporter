const debug = require('debug')('@testomatio/reporter:pipe:html');
const merge = require('lodash.merge');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const handlebars = require('handlebars');

const { fileSystem } = require('../util');
const { isSameTest } = require('../util');

const HTML_REPORT_FOLDER = "html-report"; //TODO: move to constant
const HTML_REPORT_DEFAULT_NAME = "testomatio-report.html";  
// const { result } = require('../template/data'); //TODO: remove before publishing

class HtmlPipe {
    constructor(params, store = {}) {
        this.store = store || {};
        this.title = params.title || process.env.TESTOMATIO_TITLE; //TODO: remove comments
        this.apiKey = params.apiKey || process.env.TESTOMATIO;
        this.isHtml = process.env.TESTOMATIO_HTML_REPORT_SAVE;
        
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
            this.htmlReportDir = process.env.TESTOMATIO_HTML_REPORT_FOLDER || HTML_REPORT_FOLDER;
            this.htmlReportName = process.env.TESTOMATIO_HTML_FILENAME || HTML_REPORT_DEFAULT_NAME;

            this.templateFolderPath = path.resolve(process.cwd(), 'node_modules', '@testomatio', 'reporter', 'lib', 'template');
            this.templateHtmlPath = path.resolve(this.templateFolderPath, 'template-small.hbs'); //TODO: only for testing
            // this.templateHtmlPath = path.resolve(this.templateFolderPath, 'template.hbs'); //TODO: use this one before publishing
            this.htmlOutputPath = path.join(this.htmlReportDir, this.htmlReportName); //TODO: how should be created
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

    updateRun() { }

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

        const { suite_title, title, status, message, stack } = test;

        this.tests.push({
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
        // GENERATE HTML reports based on the results data
        // console.log("tests", this.tests);
        // const data = Object.assign(this, runParams);
        // console.log("FULL-DATA", data)
        // this.buildReport(data);
        // this.buildReport(this.results);

        const data = Object.assign({
                runId: this.store.runId,
                status: runParams.status,
                parallel: runParams.isParallel,
                runUrl: this.store.runUrl                
            }, 
            {
                tests: this.tests
            }
        );
        console.log("Report Data", data);
    }

    buildReport(data) {        
        debug('HTML tests data:', data);    

        if (!this.htmlOutputPath &&  this.htmlOutputPath !== "") {
            console.log(chalk.yellow(`HTML export path is not set, ignoring...`));
            return;
        }

        console.log(this, chalk.yellow(`The test results will be added to the HTML report. It will take some time...`));        
        // generate output HTML based on the template
        const html = this.#generateHTMLReport(data);

        fs.writeFileSync(this.htmlOutputPath, html, 'utf-8');
        console.log(`Generated HTML report saved in file: ${this.htmlOutputPath}`);
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

            // additional template files like: css, js scripts
            this.#additionalReportFiles("style.css");
            this.#additionalReportFiles("chart-my.js"); //TODO: copy all files from the /template folder
    
            return template(data);
        }
        catch (e) {
            console.log('Unknown HTML report generation error: ', e);
        }
    }

    #additionalReportFiles (filepath) {
        //TODO: in the feature - get list of all files, exclude hbs and copy to html-result folder
        if(typeof filepath === 'string') {
            const newFilepath = path.join(this.htmlReportDir, filepath);

            fs.copyFile(path.join(this.templateFolderPath, filepath), newFilepath, (err) => {
                if (err) {
                  console.log("Error Found:", err);
                }
                if (newFilepath.endsWith(".css")) {
                    console.log(`Styling file was succssfully added to the HTML report folder: ${newFilepath}`);
                }
                if (newFilepath.endsWith(".js")) {
                    console.log(`JS file was succssfully added to the HTML report folder: ${newFilepath}`)
                }
            })
        }
    }

    #loadReportHelpers() {
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
    #specFileToReport(path) {
        //some code => as in PLaywright report - by spec files / each spec includes suites and tests
        //TODO: Чи треба додавати Тест Степи як у Плею, чи поки можна копіювати репорт з клієнту без нього?
        // + Кол з Сашею, як мені сейвити результати в папку самого Фреймворку, можливо винести все в атомарне рішення????
        // #addSuiteToReport(suite);
        // #addTestToReport(test);s
    }
    // #addSuiteToReport(suite) {
         //some code => cheack if at least one suite availabel
             //      //some code TODO: => map by each availeble sites
    //     //  if no suites  => map by each available test       
        // if no - only tests are add
        // inner function
        // #addTestToReport(test)
    // }

    // #addTestToReport(test) {
        //TODO:
    //     //some code => get RUN tests and iterate one by one add to suite
    // }

    toString() {
        return 'HTML Reporter';
    }
}

module.exports = HtmlPipe;

// const html = new HtmlPipe({title: "My title"});
// html.buildReport(result); //TODO: remove before publishing