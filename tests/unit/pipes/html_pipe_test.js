import { expect } from 'chai';
import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import HtmlPipe from '../../../src/pipe/html.js';
import { fileURLToPath } from 'url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

// test data with all status types
const DATA = {
  runId: '51eb2798',
  status: 'failed',
  runUrl: 'https://beta.testomat.io/projects/codecept-new-mode-exmple/runs/51eb2798/report',
  executionTime: '0h 0m 0s 328ms',
  executionDate: '(30/07/2023 11:11:11)',
  tests: [
    {
      files: [],
      steps: '\u001b[32m\u001b[1mOn TodosPage: goto \u001b[22m\u001b[39m\n',
      status: 'passed',
      stack: 'I execute script () => sessionStorage.clear()',
      example: null,
      code: null,
      title: 'New TEST #1 item @T50e82737',
      suite_title: 'Create Tasks @step:01 @story:12 @S2f5c1942',
      test_id: '50e82737',
      message: '',
      run_time: 121,
      artifacts: [],
      api_key: 'tstmt_gRqrhBUaVxTpezGpZjRmlahOeqcRBBbDMA1692050199',
      create: false,
    },
    {
      files: [
        {
          path: '/home/codeceptjs-testomat-example/codeceptJS/output/Create_2_@T5b8d1186.failed.png',
          type: 'image/png',
        },
      ],
      steps:
        "I.say('When I enter {Todo Text}')\u001b[22m\u001b[39m\n" +
        ` Todo with html code <script>alert("hello")</script>`,
      status: 'failed',
      stack: "I.say('When I enter {Todo Text}')",
      example: null,
      code: null,
      title: 'Create a new todo TEST #2 item @T5b8d1186',
      suite_title: 'Suite 2 @smoke @story:13 @S2f5c1942',
      test_id: '5b8d1186',
      message: 'expected expected number of visible is 2, but found 1 "1" to equal "2"',
      run_time: 176,
      artifacts: [null],
      api_key: 'tstmt_gRqrhBUaVxTpezGpZjRmlahOeqcRBBbDMA1692050199',
      create: false,
    },
    {
      files: [],
      steps: 'I.click("Skip button")\nI.amOnPage("/next")',
      status: 'skipped',
      stack: 'Test was skipped due to configuration',
      example: null,
      code: null,
      title: 'Skipped test for conditional feature @T5c9d2187',
      suite_title: 'Feature Tests @feature @S3f6c2943',
      test_id: '5c9d2187',
      message: 'Test skipped: Feature not enabled in current environment',
      run_time: 0,
      artifacts: [],
      api_key: 'tstmt_gRqrhBUaVxTpezGpZjRmlahOeqcRBBbDMA1692050199',
      create: false,
    },
  ],
};

describe('HTML report tests', () => {
  // const testOutputDir = path.resolve(dirname, 'htmlOutput');
  const testOutputDir = path.resolve(process.cwd(), 'htmlOutput');
  let filepath = '';

  before(() => {
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir);
    }
  });
  after(async () => {
    try {
      await fs.promises.rm(testOutputDir, { recursive: true });
    } catch (err) {
      console.error(`Unknown error while deleting ${testOutputDir}.`);
    }
  });
  it(
    'buildReport function should save HTML report based on the testomatio.hbs template' +
      'and custom name = testomatio-report.html',
    async () => {
      process.env.TESTOMATIO_HTML_REPORT_SAVE = '1';

      const name = 'testomatio-report.html';
      const template = path.resolve(dirname, '../../..', 'src', 'template', 'testomatio.hbs');
      filepath = path.resolve(testOutputDir, name);

      const htmlPipe = new HtmlPipe({}, {});
      // call the buildReport function
      htmlPipe.buildReport({
        runParams: {
          status: 'failed',
        },
        tests: DATA.tests,
        outputPath: filepath,
        templatePath: template,
        warningMsg: '',
      });

      expect(fs.existsSync(filepath)).equal(true);
    },
  );
  it('should contain specific elements in the HTML report', () => {
    const htmlContent = fs.readFileSync(filepath, 'utf-8');
    const dom = new JSDOM(htmlContent);
    const document = dom.window.document;
    // if no runID & status
    expect(document.querySelector('title').textContent).to.include('Report Testomat.io');
    // Check that execution time is present (duration may vary)
    const timeElement = document.querySelector('.statdesc__row > span');
    expect(timeElement.textContent).to.match(/^\d+h \d+m \d+s \d+ms$/);
    expect(document.querySelectorAll('.statdesc__row span')[2].textContent).to.include(getCurrentDate());
  });

  it('should render test status counters correctly for all status types', () => {
    const htmlContent = fs.readFileSync(filepath, 'utf-8');
    const dom = new JSDOM(htmlContent);
    const document = dom.window.document;

    // Check that status filter buttons exist
    const allTestsButton = document.querySelector('label[for="allTest"]');
    const passedTestsButton = document.querySelector('label[for="passedTest"]');
    const failedTestsButton = document.querySelector('label[for="failedTest"]');
    const skippedTestsButton = document.querySelector('label[for="skippedTest"]');

    expect(allTestsButton).to.exist;
    expect(passedTestsButton).to.exist;
    expect(failedTestsButton).to.exist;
    expect(skippedTestsButton).to.exist;

    // Check that buttons have correct styling
    expect(passedTestsButton.classList.contains('btn-passed')).to.be.true;
    expect(failedTestsButton.classList.contains('btn-failed')).to.be.true;
    expect(skippedTestsButton.classList.contains('btn-skipped')).to.be.true;

    // Check button text content
    expect(passedTestsButton.textContent).to.include('Passed');
    expect(failedTestsButton.textContent).to.include('Failed');
    expect(skippedTestsButton.textContent).to.include('Skipped');
  });

  it('should contain JavaScript logic for processing different test statuses', () => {
    const htmlContent = fs.readFileSync(filepath, 'utf-8');

    // Check that the HTML contains JavaScript functions that handle different statuses
    // Note: The JavaScript may be minified, so we check for the actual logic patterns
    expect(htmlContent).to.include("category === 'passed'");
    expect(htmlContent).to.include("category === 'skipped'");
    expect(htmlContent).to.include('else {'); // This covers the failed case

    // Check for status-related CSS classes in JavaScript
    expect(htmlContent).to.include("image.classList.add('passed')");
    expect(htmlContent).to.include("image.classList.add('failed')");
    expect(htmlContent).to.include("image.classList.add('skipped')");

    // Check for status processing in content
    expect(htmlContent).to.include('category.toUpperCase()');
  });

  it('should include Google Charts data with test status distribution', () => {
    const htmlContent = fs.readFileSync(filepath, 'utf-8');

    // Check that Google Charts script is included
    expect(htmlContent).to.include('google.charts.load');
    expect(htmlContent).to.include('google.visualization.arrayToDataTable');

    // Check for test count variables - the actual values will be substituted by Handlebars
    expect(htmlContent).to.include('passedTests =');
    expect(htmlContent).to.include('failedTests =');
    expect(htmlContent).to.include('skippedTests =');

    // Check for chart colors that correspond to status types
    expect(htmlContent).to.include("'colors': ['#A9C7FF', '#75B583', '#FF6363', '#FFC350']");

    // Check for chart data structure
    expect(htmlContent).to.include("['Passed', passedTests]");
    expect(htmlContent).to.include("['Failed', failedTests]");
    expect(htmlContent).to.include("['Skipped', skippedTests]");
  });

  it('should handle test data properly for all status types', () => {
    const htmlContent = fs.readFileSync(filepath, 'utf-8');
    const dom = new JSDOM(htmlContent);
    const document = dom.window.document;

    // Execute the page JavaScript to test data processing
    const scriptElements = document.querySelectorAll('script');
    let testEntriesScript = '';

    for (const script of scriptElements) {
      if (script.textContent && script.textContent.includes('testEntries')) {
        testEntriesScript = script.textContent;
        break;
      }
    }

    // Check that the script contains the test data structure
    expect(testEntriesScript).to.include('testEntries');
    expect(testEntriesScript).to.include('totalTests');

    // Verify that status categories are defined
    expect(testEntriesScript).to.include("'all'");
    expect(testEntriesScript).to.include("'passed'");
    expect(testEntriesScript).to.include("'failed'");
    expect(testEntriesScript).to.include("'skipped'");
  });

  it('should calculate correct test counts for each status type', () => {
    const htmlContent = fs.readFileSync(filepath, 'utf-8');
    const dom = new JSDOM(htmlContent);
    const document = dom.window.document;

    // Count expected test statuses from our test data
    const expectedPassedCount = DATA.tests.filter(test => test.status === 'passed').length;
    const expectedFailedCount = DATA.tests.filter(test => test.status === 'failed').length;
    const expectedSkippedCount = DATA.tests.filter(test => test.status === 'skipped').length;
    const expectedTotalCount = DATA.tests.length;

    // Check that the total test count is displayed correctly in the stats section
    const testStatElements = document.querySelectorAll('.statdesc__row span');
    let foundTestCount = false;
    for (const element of testStatElements) {
      if (element.textContent === expectedTotalCount.toString()) {
        foundTestCount = true;
        break;
      }
    }
    expect(foundTestCount).to.be.true;

    // Verify that the actual test counts in the HTML match our expectations
    // The test counts are rendered as literal values in the JavaScript
    expect(htmlContent).to.match(/passedTests =\s*1/);
    expect(htmlContent).to.match(/failedTests =\s*1/);
    expect(htmlContent).to.match(/skippedTests =\s*1/);

    // Based on our test data, we should have:
    // 1 passed test, 1 failed test, 1 skipped test
    expect(expectedPassedCount).to.equal(1);
    expect(expectedFailedCount).to.equal(1);
    expect(expectedSkippedCount).to.equal(1);
    expect(expectedTotalCount).to.equal(3);
  });

  it('should render filter functionality for different test statuses', () => {
    const htmlContent = fs.readFileSync(filepath, 'utf-8');
    const dom = new JSDOM(htmlContent);
    const document = dom.window.document;

    // Check that radio inputs for filtering exist
    const allTestRadio = document.querySelector('input[id="allTest"]');
    const passedTestRadio = document.querySelector('input[id="passedTest"]');
    const failedTestRadio = document.querySelector('input[id="failedTest"]');
    const skippedTestRadio = document.querySelector('input[id="skippedTest"]');

    expect(allTestRadio).to.exist;
    expect(passedTestRadio).to.exist;
    expect(failedTestRadio).to.exist;
    expect(skippedTestRadio).to.exist;

    // Check that radio buttons have correct category attributes
    expect(allTestRadio.getAttribute('category')).to.equal('all');
    expect(passedTestRadio.getAttribute('category')).to.equal('passed');
    expect(failedTestRadio.getAttribute('category')).to.equal('failed');
    expect(skippedTestRadio.getAttribute('category')).to.equal('skipped');

    // Check that the 'all' filter is selected by default
    expect(allTestRadio.hasAttribute('checked')).to.be.true;

    // Check that filtering JavaScript functions exist
    expect(htmlContent).to.include('showBlockForCategory');
    expect(htmlContent).to.include("category = input.getAttribute('category')");
  });

  it('should include proper status styling and visual indicators', () => {
    const htmlContent = fs.readFileSync(filepath, 'utf-8');

    // Check for status-specific CSS styling
    expect(htmlContent).to.include('.btn-passed');
    expect(htmlContent).to.include('.btn-failed');
    expect(htmlContent).to.include('.btn-skipped');

    // Check for status-specific colors
    expect(htmlContent).to.include('#75B583'); // Passed color (green)
    expect(htmlContent).to.include('#FF6363'); // Failed color (red)
    expect(htmlContent).to.include('#FFC350'); // Skipped color (yellow/orange)

    // Check for hover states
    expect(htmlContent).to.include('.btn-passed:hover');
    expect(htmlContent).to.include('.btn-failed:hover');
    expect(htmlContent).to.include('.btn-skipped:hover');

    // Check for checked states
    expect(htmlContent).to.include('.passedTest:checked');
    expect(htmlContent).to.include('.failedTest:checked');
    expect(htmlContent).to.include('.skippedTest:checked');
  });

  it('should verify that all test data from different statuses is properly processed', () => {
    const htmlContent = fs.readFileSync(filepath, 'utf-8');

    // Check that test titles from all status types are included
    expect(htmlContent).to.include('New TEST #1 item @T50e82737'); // passed test
    expect(htmlContent).to.include('Create a new todo TEST #2 item @T5b8d1186'); // failed test
    expect(htmlContent).to.include('Skipped test for conditional feature @T5c9d2187'); // skipped test

    // Check that suite titles are included
    expect(htmlContent).to.include('Create Tasks @step:01 @story:12 @S2f5c1942');
    expect(htmlContent).to.include('Suite 2 @smoke @story:13 @S2f5c1942');
    expect(htmlContent).to.include('Feature Tests @feature @S3f6c2943');

    // Verify the test data structure includes exactly 1 test per status
    const passedTestsFromData = DATA.tests.filter(test => test.status === 'passed');
    const failedTestsFromData = DATA.tests.filter(test => test.status === 'failed');
    const skippedTestsFromData = DATA.tests.filter(test => test.status === 'skipped');

    expect(passedTestsFromData).to.have.length(1);
    expect(failedTestsFromData).to.have.length(1);
    expect(skippedTestsFromData).to.have.length(1);
  });
});

function getCurrentDate() {
  const currentDate = new Date();
  const day = currentDate.getDate().toString().padStart(2, '0');
  const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
  const year = currentDate.getFullYear();

  return `(${day}/${month}/${year}`;
}
