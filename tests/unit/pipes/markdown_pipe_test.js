import { expect } from 'chai';
import fs from 'fs';
import path from 'path';
import MarkdownPipe from '../../../src/pipe/markdown.js';
import { fileURLToPath } from 'url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

const DATA = {
  runId: '51eb2798',
  status: 'failed',
  runUrl: 'https://beta.testomat.io/projects/codecept-new-mode-exmple/runs/51eb2798/report',
  tests: [
    {
      files: [],
      steps: [
        {
          category: 'user',
          title: 'On TodosPage: goto',
          duration: 121,
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
    },
    {
      files: [
        {
          path: '/tmp/screenshots/Create_2_@T5b8d1186.failed.png',
          type: 'image/png',
        },
      ],
      steps: 'I.say("When I enter Todo Text")\nI.click("Submit")',
      status: 'failed',
      stack: 'AssertionError: expected number of visible is 2, but found 1\n    at Context.<anonymous> (test.js:42:7)',
      example: null,
      code: null,
      title: 'Create a new todo TEST #2 item @T5b8d1186',
      suite_title: 'Suite 2 @smoke @story:13 @S2f5c1942',
      test_id: '5b8d1186',
      message: 'expected expected number of visible is 2, but found 1 "1" to equal "2"',
      run_time: 176,
      artifacts: [null],
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
    },
  ],
};

describe('Markdown report tests', () => {
  const testOutputDir = path.resolve(process.cwd(), 'mdOutput');
  let filepath = '';
  let mdContent = '';
  let envSnapshot;

  before(() => {
    envSnapshot = { ...process.env };
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir);
    }
  });

  after(async () => {
    // Restore env so leaked TESTOMATIO_* vars from these tests don't pollute
    // sibling pipe tests (e.g. testomatio_pipe_test.js, which talks to a mock
    // server and breaks if TESTOMATIO_RUN looks like an existing run id).
    process.env = envSnapshot;
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

  it('buildReport should write a Markdown file with the requested name', () => {
    process.env.TESTOMATIO_MARKDOWN_REPORT_SAVE = '1';
    process.env.TESTOMATIO_RUN = 'abc-run-id';

    const name = 'testomatio-report.md';
    filepath = path.resolve(testOutputDir, name);

    const pipe = new MarkdownPipe({ title: 'Sample Run' }, { runId: DATA.runId, runUrl: DATA.runUrl });
    pipe.buildReport({
      runParams: { status: 'failed', isParallel: false },
      tests: DATA.tests,
      outputPath: filepath,
      warningMsg: '',
    });

    expect(fs.existsSync(filepath)).to.equal(true);
    mdContent = fs.readFileSync(filepath, 'utf-8');
  });

  it('contains an H1 title with the overall status', () => {
    expect(mdContent).to.match(/^# Sample Run — FAILED/m);
  });

  it('contains a Summary section with a stats table', () => {
    expect(mdContent).to.include('## Summary');
    expect(mdContent).to.include('| Total | Passed | Failed | Skipped | Todo | Flaky |');
    expect(mdContent).to.match(/\|\s*4\s*\|\s*1\s*\|\s*1\s*\|\s*1\s*\|\s*1\s*\|\s*0\s*\|/);
  });

  it('contains a Run Metadata table with run id and URL', () => {
    expect(mdContent).to.include('## Run Metadata');
    expect(mdContent).to.include('| Run ID | `51eb2798` |');
    expect(mdContent).to.include(`<${DATA.runUrl}>`);
  });

  it('groups tests under suite headings', () => {
    expect(mdContent).to.include('### Suite: Create Tasks @step:01 @story:12 @S2f5c1942');
    expect(mdContent).to.include('### Suite: Suite 2 @smoke @story:13 @S2f5c1942');
    expect(mdContent).to.include('### Suite: Feature Tests @feature @S3f6c2943');
    expect(mdContent).to.include('### Suite: Todo Tests @todo @S4g7d3054');
  });

  it('renders user steps as a nested bulleted list', () => {
    expect(mdContent).to.include('**Steps**');
    expect(mdContent).to.match(/-\s+On TodosPage: goto/);
    expect(mdContent).to.match(/\n\s{2}-\s+Fill todo title/);
  });

  it('renders failed test stack inside a fenced code block', () => {
    expect(mdContent).to.include('**Stack Trace**');
    expect(mdContent).to.match(/```\nAssertionError: expected number of visible is 2[\s\S]*?\n```/);
  });

  it('renders the failure message as a blockquote', () => {
    expect(mdContent).to.include('**Message**');
    expect(mdContent).to.include('> expected expected number of visible is 2, but found 1');
  });

  it('renders local image artifact as a markdown image', () => {
    expect(mdContent).to.match(/!\[Create_2_@T5b8d1186\.failed\.png\]\(file:\/\/[^)]+\.png\)/);
  });

  it('renders remote image artifact as a markdown image with https URL', () => {
    expect(mdContent).to.include('![skipped-test.png](https://example-bucket.r2.cloudflarestorage.com/run-1/skipped-test.png)');
  });

  it('marks pending+todo test as todo in the stats and per-test status', () => {
    const todoSection = mdContent.split('Todo test implementation')[1] || '';
    expect(todoSection).to.include('| Status | todo |');
  });

  it('renders per-test meta as a table', () => {
    expect(mdContent).to.include('| Status | failed |');
    expect(mdContent).to.include('| Test ID | `5b8d1186` |');
  });

  it('does not include an Environment section', () => {
    expect(mdContent).to.not.include('## Environment');
    expect(mdContent).to.not.include('Testomat.io variables');
  });

  it('wraps artifacts in a collapsible details block', () => {
    expect(mdContent).to.match(/<details>\s*\n<summary><strong>Artifacts<\/strong> \(\d+\)<\/summary>/);
  });

  it('renders run description from store as a Description section', () => {
    process.env.TESTOMATIO_MARKDOWN_REPORT_SAVE = '1';
    const store = {
      runId: DATA.runId,
      runUrl: DATA.runUrl,
      coverageDescription: 'Changes to **3** files in feature to main.\n\n* `src/a.js`\n* `src/b.js`',
    };
    const pipe = new MarkdownPipe({ title: 'With Desc' }, store);
    const out = path.resolve(testOutputDir, 'with-description.md');
    pipe.buildReport({
      runParams: { status: 'passed' },
      tests: DATA.tests.slice(0, 1),
      outputPath: out,
      warningMsg: '',
    });
    const content = fs.readFileSync(out, 'utf-8');
    expect(content).to.include('## Description');
    expect(content).to.include('Changes to **3** files in feature to main.');
    expect(content).to.include('* `src/a.js`');
  });

  it('omits the Description section when no description is provided', () => {
    expect(mdContent).to.not.include('## Description');
  });

  it('renders run configuration as a Configuration section', async () => {
    process.env.TESTOMATIO_MARKDOWN_REPORT_SAVE = '1';
    const pipe = new MarkdownPipe({ title: 'With Config' }, {});
    await pipe.createRun({ configuration: { exploratory: true, browser: 'chromium', shard: 2 } });
    const out = path.resolve(testOutputDir, 'with-configuration.md');
    pipe.buildReport({
      runParams: { status: 'passed' },
      tests: DATA.tests.slice(0, 1),
      outputPath: out,
      warningMsg: '',
    });
    const content = fs.readFileSync(out, 'utf-8');
    expect(content).to.include('## Configuration');
    expect(content).to.match(/\|\s*`browser`\s*\|\s*chromium\s*\|/);
    expect(content).to.match(/\|\s*`exploratory`\s*\|\s*true\s*\|/);
    expect(content).to.match(/\|\s*`shard`\s*\|\s*2\s*\|/);
  });

  it('omits the Configuration section when no configuration is provided', () => {
    expect(mdContent).to.not.include('## Configuration');
  });

  it('toString returns the pipe label', () => {
    const pipe = new MarkdownPipe({}, {});
    expect(pipe.toString()).to.equal('Markdown Reporter');
  });

  it('isEnabled is false when TESTOMATIO_MARKDOWN_REPORT_SAVE is unset', () => {
    delete process.env.TESTOMATIO_MARKDOWN_REPORT_SAVE;
    const pipe = new MarkdownPipe({}, {});
    expect(pipe.isEnabled).to.equal(false);
  });

  it('uses runtime CodeceptJS reportDir config', () => {
    const pipe = new MarkdownPipe({ markdown: true, reportDir: path.join('output', 'report') }, {});

    expect(pipe.isEnabled).to.equal(true);
    expect(pipe.markdownReportDir).to.equal(path.join('output', 'report'));
  });
});
