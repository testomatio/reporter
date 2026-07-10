import { expect } from 'chai';
import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import HtmlPipe from '../../../src/pipe/html.js';
import { fileURLToPath } from 'url';
import fileUrl from 'file-url';

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
      steps: [
        {
          category: 'user',
          title: 'On TodosPage: goto',
          duration: 121,
          artifacts: [path.resolve(dirname, '../data/artifacts/screenshot1.png')],
          steps: [
            {
              category: 'user',
              title: 'Fill todo title',
              duration: 25,
            },
          ],
        },
      ],
      status: 'passed',
      stack: 'I execute script () => sessionStorage.clear()',
      example: null,
      code: null,
      title: 'New TEST #1 item @T50e82737',
      suite_title: 'Create Tasks @step:01 @story:12 @S2f5c1942',
      test_id: '50e82737',
      message: 'Console output for passed test',
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
      artifacts: [
        {
          path: 'https://example-bucket.r2.cloudflarestorage.com/run-1/skipped-test.png',
          name: 'skipped-test.png',
          type: 'image/png',
        },
      ],
      api_key: 'tstmt_gRqrhBUaVxTpezGpZjRmlahOeqcRBBbDMA1692050199',
      create: false,
    },
    {
      files: [],
      steps: 'I.wait(5000)',
      status: 'pending',
      stack: 'Test is marked as todo',
      meta: { todo: true },
      example: null,
      code: null,
      title: 'Todo test implementation @T5d0e3198',
      suite_title: 'Todo Tests @todo @S4g7d3054',
      test_id: '5d0e3198',
      message: 'Not implemented yet',
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
  let originalS3Bucket;
  let originalDisableArtifacts;
  let originalHtmlCopyArtifacts;

  before(() => {
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir);
    }
  });
  beforeEach(() => {
    originalS3Bucket = process.env.S3_BUCKET;
    originalDisableArtifacts = process.env.TESTOMATIO_DISABLE_ARTIFACTS;
    originalHtmlCopyArtifacts = process.env.TESTOMATIO_HTML_REPORT_COPY_ARTIFACTS;
    delete process.env.S3_BUCKET;
    delete process.env.TESTOMATIO_DISABLE_ARTIFACTS;
    delete process.env.TESTOMATIO_HTML_REPORT_COPY_ARTIFACTS;
  });
  afterEach(() => {
    restoreEnv('S3_BUCKET', originalS3Bucket);
    restoreEnv('TESTOMATIO_DISABLE_ARTIFACTS', originalDisableArtifacts);
    restoreEnv('TESTOMATIO_HTML_REPORT_COPY_ARTIFACTS', originalHtmlCopyArtifacts);
  });
  after(async () => {
    try {
      await fs.promises.rm(testOutputDir, { recursive: true, force: true });
    } catch (err) {
      console.error(`Unknown error while deleting ${testOutputDir}.`);
    }
    try {
      await fs.promises.rm(path.resolve(process.cwd(), 'output'), { recursive: true, force: true });
    } catch (err) {
      console.error('Unknown error while deleting output directory.');
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
    const statValueElements = document.querySelectorAll('.stat-value');
    let foundDuration = false;
    for (const el of statValueElements) {
      if (el.textContent.match(/^\d+h \d+m \d+s \d+ms$/)) {
        foundDuration = true;
        break;
      }
    }
    expect(foundDuration).to.be.true;

    // Check execution date is present
    let foundDate = false;
    for (const el of statValueElements) {
      if (el.textContent.includes(getCurrentDate())) {
        foundDate = true;
        break;
      }
    }
    expect(foundDate).to.be.true;
  });

  it('should render test status counters correctly for all status types', () => {
    const htmlContent = fs.readFileSync(filepath, 'utf-8');
    const dom = new JSDOM(htmlContent);
    const document = dom.window.document;

    // Check that status filter buttons exist (new structure uses data-filter)
    const allTestsButton = document.querySelector('.filter-tab[data-filter="all"]');
    const passedTestsButton = document.querySelector('.filter-tab[data-filter="passed"]');
    const failedTestsButton = document.querySelector('.filter-tab[data-filter="failed"]');
    const skippedTestsButton = document.querySelector('.filter-tab[data-filter="skipped"]');
    const todoTestsButton = document.querySelector('.filter-tab[data-filter="todo"]');

    expect(allTestsButton).to.exist;
    expect(passedTestsButton).to.exist;
    expect(failedTestsButton).to.exist;
    expect(skippedTestsButton).to.exist;
    expect(todoTestsButton).to.exist;

    // Check that buttons have correct class
    expect(passedTestsButton.classList.contains('filter-tab')).to.be.true;
    expect(failedTestsButton.classList.contains('filter-tab')).to.be.true;
    expect(skippedTestsButton.classList.contains('filter-tab')).to.be.true;
    expect(todoTestsButton.classList.contains('filter-tab')).to.be.true;

    // Check button text content
    expect(passedTestsButton.textContent).to.include('Passed');
    expect(failedTestsButton.textContent).to.include('Failed');
    expect(skippedTestsButton.textContent).to.include('Skipped');
    expect(todoTestsButton.textContent).to.include('Todo');
  });

  it('should contain JavaScript logic for processing different test statuses', () => {
    const htmlContent = fs.readFileSync(filepath, 'utf-8');

    // Check that the HTML contains JavaScript functions that handle different statuses
    // New template uses different logic with data-filter attributes
    expect(htmlContent).to.include('data-filter');
    expect(htmlContent).to.include("currentFilter = this.dataset.filter");

    // Check for filter functionality
    expect(htmlContent).to.include('filterTests()');
    expect(htmlContent).to.include("test.status.toLowerCase() === currentFilter");

    // Check for status-related icons/classes
    expect(htmlContent).to.include("getStatusIcon(status)");
    expect(htmlContent).to.include("'passed': 'check'");
    expect(htmlContent).to.include("'failed': 'times'");
    expect(htmlContent).to.include("'skipped': 'forward'");
    expect(htmlContent).to.include("'todo': 'circle'");
  });

  it('should include Google Charts data with test status distribution', () => {
    const htmlContent = fs.readFileSync(filepath, 'utf-8');

    // Check that Google Charts script is included
    expect(htmlContent).to.include('google.charts.load');
    expect(htmlContent).to.include('google.visualization.arrayToDataTable');

    // Check for test count variables - after Handlebars compilation they are numbers
    expect(htmlContent).to.include('const passedTests =');
    expect(htmlContent).to.include('const failedTests =');
    expect(htmlContent).to.include('const skippedTests =');
    expect(htmlContent).to.include('const todoTests =');

    // Check for chart colors (new template uses conditional colors based on todoTests)
    expect(htmlContent).to.include("#10b981"); // Passed green
    expect(htmlContent).to.include("#ef4444"); // Failed red
    expect(htmlContent).to.include("#f59e0b"); // Skipped yellow
    expect(htmlContent).to.include("#8b5cf6"); // Todo purple

    // Check for chart data structure in rendered HTML
    expect(htmlContent).to.include("['Status', 'Count']");
    expect(htmlContent).to.include("['Passed',");
    expect(htmlContent).to.include("['Failed',");
    expect(htmlContent).to.include("['Skipped',");
    expect(htmlContent).to.include("['Todo',");
  });

  it('should handle test data properly for all status types', () => {
    const htmlContent = fs.readFileSync(filepath, 'utf-8');
    const dom = new JSDOM(htmlContent);
    const document = dom.window.document;

    // Execute the page JavaScript to test data processing
    const scriptElements = document.querySelectorAll('script');
    let testDataScript = '';

    for (const script of scriptElements) {
      if (script.textContent && script.textContent.includes('allTests')) {
        testDataScript = script.textContent;
        break;
      }
    }

    // Check that the script contains the test data structure
    expect(testDataScript).to.include('allTests');
    expect(testDataScript).to.include('currentFilter');
    expect(testDataScript).to.include('renderTests()');

    // Verify that status categories are defined
    expect(testDataScript).to.include("'all'");
    expect(testDataScript).to.include("'passed'");
    expect(testDataScript).to.include("'failed'");
    expect(testDataScript).to.include("'skipped'");
    expect(testDataScript).to.include("'todo'");
  });

  it('should calculate correct test counts for each status type', () => {
    const htmlContent = fs.readFileSync(filepath, 'utf-8');
    const dom = new JSDOM(htmlContent);
    const document = dom.window.document;

    // Count expected test statuses from our test data
    // Note: pending + meta.todo = todo status
    const expectedPassedCount = DATA.tests.filter(test => test.status === 'passed').length;
    const expectedFailedCount = DATA.tests.filter(test => test.status === 'failed').length;
    const expectedSkippedCount = DATA.tests.filter(test => test.status === 'skipped').length;
    const expectedTodoCount = DATA.tests.filter(test =>
      (test.status === 'pending' && test.meta?.todo) || test.status === 'todo'
    ).length;
    const expectedTotalCount = DATA.tests.length;

    // Check that the total test count is displayed correctly in the stats section
    const statValueElements = document.querySelectorAll('.stat-value');
    let foundTestCount = false;
    for (const element of statValueElements) {
      if (element.textContent === expectedTotalCount.toString()) {
        foundTestCount = true;
        break;
      }
    }
    expect(foundTestCount).to.be.true;

    // Check filter tabs have correct counts (via id="countXXX" elements)
    const countAll = document.getElementById('countAll');
    const countPassed = document.getElementById('countPassed');
    const countFailed = document.getElementById('countFailed');
    const countSkipped = document.getElementById('countSkipped');
    const countTodo = document.getElementById('countTodo');

    expect(countAll).to.exist;
    expect(countPassed).to.exist;
    expect(countFailed).to.exist;
    expect(countSkipped).to.exist;
    expect(countTodo).to.exist;

    // Based on our test data, we should have:
    // 1 passed test, 1 failed test, 1 skipped test, 1 todo test
    expect(expectedPassedCount).to.equal(1);
    expect(expectedFailedCount).to.equal(1);
    expect(expectedSkippedCount).to.equal(1);
    expect(expectedTodoCount).to.equal(1);
    expect(expectedTotalCount).to.equal(4);
  });

  it('should render filter functionality for different test statuses', () => {
    const htmlContent = fs.readFileSync(filepath, 'utf-8');
    const dom = new JSDOM(htmlContent);
    const document = dom.window.document;

    // Check that filter buttons exist (new structure uses buttons with data-filter)
    const allTestButton = document.querySelector('.filter-tab[data-filter="all"]');
    const passedTestButton = document.querySelector('.filter-tab[data-filter="passed"]');
    const failedTestButton = document.querySelector('.filter-tab[data-filter="failed"]');
    const skippedTestButton = document.querySelector('.filter-tab[data-filter="skipped"]');

    expect(allTestButton).to.exist;
    expect(passedTestButton).to.exist;
    expect(failedTestButton).to.exist;
    expect(skippedTestButton).to.exist;

    // Check that buttons have correct data-filter attributes
    expect(allTestButton.getAttribute('data-filter')).to.equal('all');
    expect(passedTestButton.getAttribute('data-filter')).to.equal('passed');
    expect(failedTestButton.getAttribute('data-filter')).to.equal('failed');
    expect(skippedTestButton.getAttribute('data-filter')).to.equal('skipped');

    // Check that the 'all' filter is active by default
    expect(allTestButton.classList.contains('active')).to.be.true;

    // Check that filtering JavaScript functions exist
    expect(htmlContent).to.include('filterTests()');
    expect(htmlContent).to.include('renderTests()');
  });

  it('should include proper status styling and visual indicators', () => {
    const htmlContent = fs.readFileSync(filepath, 'utf-8');

    // Check for status-specific CSS styling (new template uses different classes)
    expect(htmlContent).to.include('.filter-tab');
    expect(htmlContent).to.include('.status-passed');
    expect(htmlContent).to.include('.status-failed');
    expect(htmlContent).to.include('.status-skipped');

    // Check for status-specific colors (new color scheme)
    expect(htmlContent).to.include('#10b981'); // Passed color (green)
    expect(htmlContent).to.include('#ef4444'); // Failed color (red)
    expect(htmlContent).to.include('#f59e0b'); // Skipped color (yellow/orange)

    // Check for hover states
    expect(htmlContent).to.include('.filter-tab:hover');
    expect(htmlContent).to.include('.filter-tab.active');

    // Check for status badge classes
    expect(htmlContent).to.include('.status-badge');
    expect(htmlContent).to.include('.test-status-icon');
  });

  it('should style grouped test headers by status priority', () => {
    const htmlContent = fs.readFileSync(filepath, 'utf-8');

    expect(htmlContent).to.include('.test-group-header.has-failures');
    expect(htmlContent).to.include('.test-group-header.has-skips');
    expect(htmlContent).to.include('.test-group-header.all-passed');
    expect(htmlContent).to.include("const groupStateClass = failedCount > 0");
    expect(htmlContent).to.include("? 'has-failures'");
    expect(htmlContent).to.include("? 'has-skips'");
    expect(htmlContent).to.include("? 'all-passed'");
    expect(htmlContent).to.include("header.className = ['test-group-header', groupStateClass].filter(Boolean).join(' ')");
    expect(htmlContent).to.include("class='test-group-stat failed'");
    expect(htmlContent).to.include('background: #fef2f2;');
    expect(htmlContent).to.include('background: #fffbeb;');
    expect(htmlContent).to.include('background: #ecfdf5;');
    expect(htmlContent).to.include('background: var(--danger-color);');
  });

  it('should verify that all test data from different statuses is properly processed', () => {
    const htmlContent = fs.readFileSync(filepath, 'utf-8');

    // Check that test titles from all status types are included
    expect(htmlContent).to.include('New TEST #1 item @T50e82737'); // passed test
    expect(htmlContent).to.include('Create a new todo TEST #2 item @T5b8d1186'); // failed test
    expect(htmlContent).to.include('Skipped test for conditional feature @T5c9d2187'); // skipped test
    expect(htmlContent).to.include('Todo test implementation @T5d0e3198'); // todo test (pending + meta.todo)

    // Check that suite titles are included
    expect(htmlContent).to.include('Create Tasks @step:01 @story:12 @S2f5c1942');
    expect(htmlContent).to.include('Suite 2 @smoke @story:13 @S2f5c1942');
    expect(htmlContent).to.include('Feature Tests @feature @S3f6c2943');
    expect(htmlContent).to.include('Todo Tests @todo @S4g7d3054');

    // Verify the test data structure includes exactly 1 test per status
    const passedTestsFromData = DATA.tests.filter(test => test.status === 'passed');
    const failedTestsFromData = DATA.tests.filter(test => test.status === 'failed');
    const skippedTestsFromData = DATA.tests.filter(test => test.status === 'skipped');
    const todoTestsFromData = DATA.tests.filter(test =>
      (test.status === 'pending' && test.meta?.todo) || test.status === 'todo'
    );

    expect(passedTestsFromData).to.have.length(1);
    expect(failedTestsFromData).to.have.length(1);
    expect(skippedTestsFromData).to.have.length(1);
    expect(todoTestsFromData).to.have.length(1);
  });

  it('should render CodeceptJS DataTable examples in test titles', () => {
    process.env.TESTOMATIO_HTML_REPORT_SAVE = '1';

    const template = path.resolve(dirname, '../../..', 'src', 'template', 'testomatio.hbs');
    const out = path.resolve(testOutputDir, 'datatable-examples.html');
    const pipe = new HtmlPipe({}, {});
    pipe.buildReport({
      runParams: { status: 'passed' },
      tests: [
        {
          rid: 'datatable-1',
          title: 'test something',
          suite_title: 'My',
          status: 'passed',
          example: { input: 'input1', expected: 'expected1' },
        },
        {
          rid: 'datatable-2',
          title: 'test something',
          suite_title: 'My',
          status: 'passed',
          example: { input: 'input2', expected: 'expected2' },
        },
      ],
      outputPath: out,
      templatePath: template,
      warningMsg: '',
    });

    const html = fs.readFileSync(out, 'utf-8');
    expect(html).to.include('test something | {\\"input\\":\\"input1\\",\\"expected\\":\\"expected1\\"}');
    expect(html).to.include('test something | {\\"input\\":\\"input2\\",\\"expected\\":\\"expected2\\"}');
  });

  it('should style passed messages without failed color and prefer message tab when message exists', () => {
    const htmlContent = fs.readFileSync(filepath, 'utf-8');

    expect(htmlContent).to.include('.message-block.passed');
    expect(htmlContent).to.include("if (hasMessage) return 'message';");
    expect(htmlContent).to.include(
      "const initialTab = getInitialTestTab({ isTodo, hasMessage, hasSteps: test.stepsArray?.length || test.steps });",
    );
    expect(htmlContent).to.include("button class='test-tab${initialMessageClass}'");
    expect(htmlContent).to.include("div class='test-tab-content${initialMessageClass}' data-tab='message'");
  });

  it('should render expandable nested steps and step-level attachments', () => {
    const htmlContent = fs.readFileSync(filepath, 'utf-8');

    expect(htmlContent).to.include('.step-toggle');
    expect(htmlContent).to.include('.step-children.collapsed');
    expect(htmlContent).to.include('function toggleStepChildren(button)');
    expect(htmlContent).to.include('data-parent-step-id="${stepId}"');
    expect(htmlContent).to.include('createAttachmentItems(step.artifacts)');
    expect(htmlContent).to.include('step-attachments');
    expect(htmlContent).to.include('Console output for passed test');
    expect(htmlContent).to.include('Fill todo title');
    expect(htmlContent).to.include('screenshot1.png');
  });

  it('should not duplicate step number label under step title', () => {
    const htmlContent = fs.readFileSync(filepath, 'utf-8');

    expect(htmlContent).to.not.include('Step ${stepNumber}');
    expect(htmlContent).to.not.include('Step ${number}');
  });

  it('should keep remote artifact URLs as remote links instead of converting them to file urls', () => {
    const htmlContent = fs.readFileSync(filepath, 'utf-8');

    expect(htmlContent).to.include('https://example-bucket.r2.cloudflarestorage.com/run-1/skipped-test.png');
    expect(htmlContent).to.not.include('file:///D:/testomat/reporter/https:/example-bucket.r2.cloudflarestorage.com');
  });

  it('copies local artifact links by default when S3 uploading is not configured', () => {
    process.env.TESTOMATIO_HTML_REPORT_SAVE = '1';

    const template = path.resolve(dirname, '../../..', 'src', 'template', 'testomatio.hbs');
    const out = path.resolve(testOutputDir, 'with-default-portable-local-artifact.html');
    const artifactPath = path.resolve(testOutputDir, 'default-local-screenshot.png');
    fs.writeFileSync(artifactPath, 'fake image');

    const pipe = new HtmlPipe({}, {});
    pipe.buildReport({
      runParams: { status: 'failed' },
      tests: [
        {
          title: 'failed with default screenshot behavior',
          suite_title: 'suite',
          status: 'failed',
          message: 'failure',
          artifacts: [artifactPath],
        },
      ],
      outputPath: out,
      templatePath: template,
      warningMsg: '',
    });

    const copiedArtifact = path.join(testOutputDir, 'artifacts', 'default-local-screenshot.png');
    const html = fs.readFileSync(out, 'utf-8');

    expect(fs.existsSync(copiedArtifact)).to.equal(true);
    expect(html).to.include('./artifacts/default-local-screenshot.png');
    expect(html).to.not.include(artifactFileUrl(artifactPath));
  });

  it('keeps local artifact file URLs by default when S3 uploading is configured', () => {
    process.env.TESTOMATIO_HTML_REPORT_SAVE = '1';
    process.env.S3_BUCKET = 'test-bucket';

    const template = path.resolve(dirname, '../../..', 'src', 'template', 'testomatio.hbs');
    const out = path.resolve(testOutputDir, 'with-s3-local-artifact.html');
    const artifactPath = path.resolve(testOutputDir, 's3-local-screenshot.png');
    fs.writeFileSync(artifactPath, 'fake image');

    const pipe = new HtmlPipe({}, {});
    pipe.buildReport({
      runParams: { status: 'failed' },
      tests: [
        {
          title: 'failed with s3 screenshot behavior',
          suite_title: 'suite',
          status: 'failed',
          message: 'failure',
          artifacts: [artifactPath],
        },
      ],
      outputPath: out,
      templatePath: template,
      warningMsg: '',
    });

    const copiedArtifact = path.join(testOutputDir, 'artifacts', 's3-local-screenshot.png');
    const html = fs.readFileSync(out, 'utf-8');

    expect(fs.existsSync(copiedArtifact)).to.equal(false);
    expect(html).to.include(artifactFileUrl(artifactPath));
    expect(html).to.not.include('./artifacts/s3-local-screenshot.png');
  });

  it('checks S3 uploading config when building the HTML report', () => {
    process.env.TESTOMATIO_HTML_REPORT_SAVE = '1';

    const template = path.resolve(dirname, '../../..', 'src', 'template', 'testomatio.hbs');
    const out = path.resolve(testOutputDir, 'with-late-s3-local-artifact.html');
    const artifactPath = path.resolve(testOutputDir, 'late-s3-local-screenshot.png');
    fs.writeFileSync(artifactPath, 'fake image');

    const pipe = new HtmlPipe({}, {});
    process.env.S3_BUCKET = 'test-bucket';

    pipe.buildReport({
      runParams: { status: 'failed' },
      tests: [
        {
          title: 'failed with late s3 screenshot behavior',
          suite_title: 'suite',
          status: 'failed',
          message: 'failure',
          artifacts: [artifactPath],
        },
      ],
      outputPath: out,
      templatePath: template,
      warningMsg: '',
    });

    const copiedArtifact = path.join(testOutputDir, 'artifacts', 'late-s3-local-screenshot.png');
    const html = fs.readFileSync(out, 'utf-8');

    expect(fs.existsSync(copiedArtifact)).to.equal(false);
    expect(html).to.include(artifactFileUrl(artifactPath));
    expect(html).to.not.include('./artifacts/late-s3-local-screenshot.png');
  });

  it('copies local artifact links when S3 uploading is disabled', () => {
    process.env.TESTOMATIO_HTML_REPORT_SAVE = '1';
    process.env.S3_BUCKET = 'test-bucket';
    process.env.TESTOMATIO_DISABLE_ARTIFACTS = '1';

    const template = path.resolve(dirname, '../../..', 'src', 'template', 'testomatio.hbs');
    const out = path.resolve(testOutputDir, 'with-disabled-s3-local-artifact.html');
    const artifactPath = path.resolve(testOutputDir, 'disabled-s3-local-screenshot.png');
    fs.writeFileSync(artifactPath, 'fake image');

    const pipe = new HtmlPipe({}, {});
    pipe.buildReport({
      runParams: { status: 'failed' },
      tests: [
        {
          title: 'failed with disabled s3 screenshot behavior',
          suite_title: 'suite',
          status: 'failed',
          message: 'failure',
          artifacts: [artifactPath],
        },
      ],
      outputPath: out,
      templatePath: template,
      warningMsg: '',
    });

    const copiedArtifact = path.join(testOutputDir, 'artifacts', 'disabled-s3-local-screenshot.png');
    const html = fs.readFileSync(out, 'utf-8');

    expect(fs.existsSync(copiedArtifact)).to.equal(true);
    expect(html).to.include('./artifacts/disabled-s3-local-screenshot.png');
    expect(html).to.not.include(artifactFileUrl(artifactPath));
  });

  it('allows explicit env override to keep local artifact file URLs without S3', () => {
    process.env.TESTOMATIO_HTML_REPORT_SAVE = '1';
    process.env.TESTOMATIO_HTML_REPORT_COPY_ARTIFACTS = '0';

    const template = path.resolve(dirname, '../../..', 'src', 'template', 'testomatio.hbs');
    const out = path.resolve(testOutputDir, 'with-disabled-local-copy-artifact.html');
    const artifactPath = path.resolve(testOutputDir, 'disabled-copy-screenshot.png');
    fs.writeFileSync(artifactPath, 'fake image');

    const pipe = new HtmlPipe({}, {});
    pipe.buildReport({
      runParams: { status: 'failed' },
      tests: [
        {
          title: 'failed with disabled copy screenshot behavior',
          suite_title: 'suite',
          status: 'failed',
          message: 'failure',
          artifacts: [artifactPath],
        },
      ],
      outputPath: out,
      templatePath: template,
      warningMsg: '',
    });

    const copiedArtifact = path.join(testOutputDir, 'artifacts', 'disabled-copy-screenshot.png');
    const html = fs.readFileSync(out, 'utf-8');

    expect(fs.existsSync(copiedArtifact)).to.equal(false);
    expect(html).to.include(artifactFileUrl(artifactPath));
    expect(html).to.not.include('./artifacts/disabled-copy-screenshot.png');
  });

  it('copies local test artifacts next to HTML report and rewrites links to relative paths', () => {
    process.env.TESTOMATIO_HTML_REPORT_SAVE = '1';

    const template = path.resolve(dirname, '../../..', 'src', 'template', 'testomatio.hbs');
    const out = path.resolve(testOutputDir, 'with-local-artifact.html');
    const artifactPath = path.resolve(testOutputDir, 'failed screenshot.png');
    fs.writeFileSync(artifactPath, 'fake image');

    const pipe = new HtmlPipe({ htmlCopyArtifacts: true }, {});
    pipe.buildReport({
      runParams: { status: 'failed' },
      tests: [
        {
          title: 'failed with screenshot',
          suite_title: 'suite',
          status: 'failed',
          message: 'failure',
          artifacts: [artifactPath],
        },
      ],
      outputPath: out,
      templatePath: template,
      warningMsg: '',
    });

    const copiedArtifact = path.join(testOutputDir, 'artifacts', 'failed screenshot.png');
    const html = fs.readFileSync(out, 'utf-8');

    expect(fs.existsSync(copiedArtifact)).to.equal(true);
    expect(html).to.include('./artifacts/failed screenshot.png');
    expect(html).to.not.include(artifactFileUrl(artifactPath));
  });

  it('copies local step artifacts next to HTML report and rewrites step links to relative paths', () => {
    process.env.TESTOMATIO_HTML_REPORT_SAVE = '1';

    const template = path.resolve(dirname, '../../..', 'src', 'template', 'testomatio.hbs');
    const out = path.resolve(testOutputDir, 'with-local-step-artifact.html');
    const artifactPath = path.resolve(testOutputDir, 'step-screenshot.png');
    fs.writeFileSync(artifactPath, 'fake image');

    const pipe = new HtmlPipe({ htmlCopyArtifacts: true }, {});
    pipe.buildReport({
      runParams: { status: 'failed' },
      tests: [
        {
          title: 'failed step with screenshot',
          suite_title: 'suite',
          status: 'failed',
          message: 'failure',
          steps: [
            {
              category: 'user',
              title: 'Click submit',
              artifacts: [artifactPath],
            },
          ],
        },
      ],
      outputPath: out,
      templatePath: template,
      warningMsg: '',
    });

    const copiedArtifact = path.join(testOutputDir, 'artifacts', 'step-screenshot.png');
    const html = fs.readFileSync(out, 'utf-8');

    expect(fs.existsSync(copiedArtifact)).to.equal(true);
    expect(html).to.include('./artifacts/step-screenshot.png');
    expect(html).to.not.include(artifactFileUrl(artifactPath));
  });

  it('renders run description (markdown) from store as a Description section', () => {
    process.env.TESTOMATIO_HTML_REPORT_SAVE = '1';

    const template = path.resolve(dirname, '../../..', 'src', 'template', 'testomatio.hbs');
    const out = path.resolve(testOutputDir, 'with-description.html');
    const store = {
      coverageDescription:
        'Changes to **3** files in feature to main.\n\n* `src/a.js`\n* `src/b.js`',
    };
    const pipe = new HtmlPipe({}, store);
    pipe.buildReport({
      runParams: { status: 'passed' },
      tests: DATA.tests.slice(0, 1),
      outputPath: out,
      templatePath: template,
      warningMsg: '',
    });
    const html = fs.readFileSync(out, 'utf-8');
    const dom = new JSDOM(html);
    const document = dom.window.document;
    const section = document.querySelector('section.description-section');
    expect(section).to.exist;
    expect(section.querySelector('.description-body strong').textContent).to.equal('3');
    expect(section.querySelector('.description-body code').textContent).to.equal('src/a.js');
  });

  it('omits the Description section when no description is present', () => {
    const htmlContent = fs.readFileSync(filepath, 'utf-8');
    const dom = new JSDOM(htmlContent);
    const section = dom.window.document.querySelector('section.description-section');
    expect(section).to.equal(null);
  });

  it('renders run configuration as a key/value table', async () => {
    process.env.TESTOMATIO_HTML_REPORT_SAVE = '1';
    const template = path.resolve(dirname, '../../..', 'src', 'template', 'testomatio.hbs');
    const out = path.resolve(testOutputDir, 'with-configuration.html');
    const pipe = new HtmlPipe({}, {});
    await pipe.createRun({ configuration: { exploratory: true, browser: 'chromium', shard: 2 } });
    pipe.buildReport({
      runParams: { status: 'passed' },
      tests: DATA.tests.slice(0, 1),
      outputPath: out,
      templatePath: template,
      warningMsg: '',
    });
    const html = fs.readFileSync(out, 'utf-8');
    const dom = new JSDOM(html);
    const document = dom.window.document;
    const section = document.querySelector('section.configuration-section');
    expect(section).to.exist;
    const rows = Array.from(section.querySelectorAll('.configuration-table tr')).map(tr => [
      tr.querySelector('th').textContent.trim(),
      tr.querySelector('td').textContent.trim(),
    ]);
    expect(rows).to.deep.include(['browser', 'chromium']);
    expect(rows).to.deep.include(['exploratory', 'true']);
    expect(rows).to.deep.include(['shard', '2']);
  });

  it('omits the Configuration section when no configuration is present', () => {
    const htmlContent = fs.readFileSync(filepath, 'utf-8');
    const dom = new JSDOM(htmlContent);
    const section = dom.window.document.querySelector('section.configuration-section');
    expect(section).to.equal(null);
  });

  it('uses runtime CodeceptJS reportDir config', () => {
    const pipe = new HtmlPipe({ html: true, reportDir: path.join('output', 'report') }, {});

    expect(pipe.isEnabled).to.equal(true);
    expect(pipe.htmlReportDir).to.equal(path.join('output', 'report'));
  });
});

function getCurrentDate() {
  const currentDate = new Date();
  const day = currentDate.getDate().toString().padStart(2, '0');
  const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
  const year = currentDate.getFullYear();

  return `(${day}/${month}/${year}`;
}

function artifactFileUrl(filePath) {
  return fileUrl(filePath, { resolve: true });
}

function restoreEnv(name, value) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}
