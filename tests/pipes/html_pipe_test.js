const { expect } = require('chai');
const fs = require('fs');
const path = require("path");
const { JSDOM } = require('jsdom');

const HtmlPipe = require('../../lib/pipe/html');

// test data
const DATA = {
    "runId": "51eb2798",
    "status": "failed",
    "runUrl": "https://beta.testomat.io/projects/codecept-new-mode-exmple/runs/51eb2798/report",
    "executionTime": "0h 0m 0s 328ms",
    "executionDate": "(30/07/2023 11:11:11)",
    "tests": [{
        "files": [],
        "steps": "\u001b[32m\u001b[1mOn TodosPage: goto \u001b[22m\u001b[39m\n",
        "status": "passed",
        "stack": "I execute script () => sessionStorage.clear()",
        "example": null,
        "code": null,
        "title": "New TEST #1 item @T50e82737",
        "suite_title": "Create Tasks @step:01 @story:12 @S2f5c1942",
        "test_id": "50e82737",
        "message": "",
        "run_time": 121,
        "artifacts": [],
        "api_key": "tstmt_gRqrhBUaVxTpezGpZjRmlahOeqcRBBbDMA1692050199",
        "create": false
    }, {
        "files": [{
            "path": "/home/codeceptjs-testomat-example/codeceptJS/output/Create_2_@T5b8d1186.failed.png",
            "type": "image/png"
        }],
        "steps": "I.say('When I enter {Todo Text}')\u001b[22m\u001b[39m\n" +
            ` Todo with html code <script>alert("hello")</script>`,
        "status": "failed",
        "stack": "I.say('When I enter {Todo Text}')",
        "example": null,
        "code": null,
        "title": "Create a new todo TEST #2 item @T5b8d1186",
        "suite_title": "Suite 2 @smoke @story:13 @S2f5c1942",
        "test_id": "5b8d1186",
        "message": "expected expected number of visible is 2, but found 1 \"1\" to equal \"2\"",
        "run_time": 176,
        "artifacts": [null],
        "api_key": "tstmt_gRqrhBUaVxTpezGpZjRmlahOeqcRBBbDMA1692050199",
        "create": false
    }]
};

describe('HTML report tests', () => {
    const testOutputDir = path.resolve(__dirname, 'htmlOutput');
    let filepath = "";

    before(() => {
        if (!fs.existsSync(testOutputDir)) {
            fs.mkdirSync(testOutputDir);
        }
    });
    after(async () => {
        try {
            await fs.promises.rm(testOutputDir, { recursive: true });
        } catch (err) {
            console.error(`Unknown error while deleting ${dir}.`);
        }
    });
    it('buildReport function should save HTML report based on the testomatio.hbs template' +
        'and custom name = testomatio-report.html', async () => {
            process.env.TESTOMATIO_HTML_REPORT_SAVE=1;

            const name = "testomatio-report.html";
            const template = path.resolve(
                __dirname,
                '../..',
                'lib',
                'template',
                'testomatio.hbs'
            );
            filepath = path.resolve(testOutputDir, name);

            const htmlPipe = new HtmlPipe({}, {});
            // call the buildReport function
            htmlPipe.buildReport({
                runParams:{
                    status: "failed",
                    parallel: "false"
                },
                tests: DATA.tests, 
                outputPath: filepath, 
                templatePath: template, 
                warningMsg: ""
            });

            expect(fs.existsSync(filepath)).equal(true);
    });
    it('should contain specific elements in the HTML report', () => {
        const htmlContent = fs.readFileSync(filepath, 'utf-8');
        const dom = new JSDOM(htmlContent);
        const document = dom.window.document;
        // if no runID & status
        expect(document.querySelector('title').textContent).to.include('Report Testomat.io');
        expect(document.querySelector('.statdesc__row > span').textContent).to.equal('0h 0m 0s 297ms');
        expect(document.querySelectorAll('.statdesc__row span')[2].textContent)
            .to.include(getCurrentDate());
    });
    // TODO: Add more tests when you have free time
});

function getCurrentDate() {
    const currentDate = new Date();
    const day = currentDate.getDate().toString().padStart(2, '0');
    const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    const year = currentDate.getFullYear();

    return `(${day}/${month}/${year}`;
}