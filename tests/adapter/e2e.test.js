import { expect } from 'chai';
import { exec } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';
import { extractTestEntries } from './utils/extract-test-entries.js';

const execAsync = promisify(exec);

// e2e refuses to start on older Node versions
function isSupportedNode() {
  const [major, minor, patch] = process.versions.node.split('.').map(Number);
  if (major === 22) return minor > 22 || (minor === 22 && patch >= 3);
  if (major === 24) return minor >= 8;
  return major > 24;
}

describe('e2e (tester-army) Adapter Tests', function () {
  this.timeout(180000);

  const exampleDir = path.join(process.cwd(), 'example', 'e2e');
  const debugFilePath = path.join(exampleDir, 'testomatio.debug.json');
  const flakyMarker = path.join(os.tmpdir(), 'testomatio-e2e-flaky.marker');

  let tests;
  let debugData;

  function removeDebugFile() {
    try {
      fs.lstatSync(debugFilePath);
      fs.unlinkSync(debugFilePath);
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
  }

  function findTest(title) {
    const test = tests.find(t => t.title === title);
    expect(test, `test "${title}" should be reported`).to.exist;
    return test;
  }

  before(async function () {
    if (!isSupportedNode()) {
      console.log(`Skipping e2e adapter tests: e2e requires Node 22.22.3+ or 24.8+, got ${process.versions.node}`);
      this.skip();
    }

    removeDebugFile();
    fs.rmSync(flakyMarker, { force: true });

    try {
      await execAsync('npx e2e run', {
        cwd: exampleDir,
        env: {
          ...process.env,
          TESTOMATIO_DEBUG: '1',
          TESTOMATIO_DISABLE_BATCH_UPLOAD: '1',
          E2E_TELEMETRY_DISABLED: '1',
        },
      });
    } catch (error) {
      // the example has an intentional failure, so e2e exits with code 1
      if (!error.stdout?.includes('Tests')) throw error;
    }

    debugData = fs
      .readFileSync(debugFilePath, 'utf-8')
      .trim()
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
    tests = extractTestEntries(debugData).map(entry => entry.testId);
  });

  after(() => {
    removeDebugFile();
    fs.rmSync(flakyMarker, { force: true });
  });

  it('creates and finishes a run', () => {
    const actions = debugData.map(entry => entry.action);
    expect(actions).to.include('createRun');

    const finish = debugData.find(entry => entry.action === 'finishRun');
    expect(finish.params.status).to.equal('failed');
    expect(finish.params.duration).to.be.greaterThan(0);
  });

  it('reports every test with its status', () => {
    expect(tests).to.have.length(8);
    expect(tests.filter(t => t.status === 'passed')).to.have.length(5);
    expect(tests.filter(t => t.status === 'failed')).to.have.length(1);
    expect(tests.filter(t => t.status === 'skipped')).to.have.length(2);
  });

  it('uses describe titles as suites and the file name for top-level tests', () => {
    expect(findTest('opens the app').suite_title).to.equal('Todo app');
    expect(findTest('is skipped by declaration').suite_title).to.equal('todo.e2e.ts');
    expect(findTest('opens the app').file).to.equal('tests/todo.e2e.ts');
  });

  it('extracts Testomat.io test id from the title', () => {
    expect(findTest('adds an item @T1a2b3c4d').test_id).to.equal('@T1a2b3c4d');
  });

  it('passes tags inherited from describe', () => {
    expect(findTest('opens the app').tags).to.deep.equal(['smoke']);
    expect(findTest('adds the first item').tags).to.deep.equal(['checkout']);
  });

  it('reports locator, assertion, and app steps', () => {
    const test = findTest('adds an item @T1a2b3c4d');
    const titles = test.steps.map(step => step.title);
    expect(titles).to.deep.equal([
      'app.open /',
      'locator.fill getByLabel("New todo")',
      'locator.click getByRole("button", name: "Add")',
      'expect.toHaveText getByRole("status")',
    ]);
    test.steps.forEach(step => {
      expect(step.category).to.equal('user');
      expect(step.status).to.equal('passed');
    });
  });

  it('reports the failure with error, failed step, and screenshot', () => {
    const test = findTest('shows a wrong counter');
    expect(test.status).to.equal('failed');
    expect(test.message).to.include('expect.toHaveText failed');
    expect(test.stack).to.include('ASSERTION_FAILED');
    expect(test.stack).to.include('text "5 items"');

    const failedStep = test.steps.at(-1);
    expect(failedStep.status).to.equal('failed');
    expect(failedStep.error.message).to.include('ASSERTION_FAILED');

    const screenshot = test.files.find(file => file.type === 'image/png');
    expect(screenshot, 'failure screenshot should be attached').to.exist;
    expect(path.isAbsolute(screenshot.path)).to.be.true;
    expect(fs.existsSync(screenshot.path)).to.be.true;
  });

  it('reports skip reasons', () => {
    expect(findTest('is skipped at runtime').stack).to.include('feature flag is off');
    expect(findTest('is skipped by declaration').stack).to.include('not implemented yet');
  });

  it('reports serial group members with their own steps', () => {
    const first = findTest('adds the first item');
    const second = findTest('adds the second item');
    expect(first.suite_title).to.equal('Checkout flow');
    expect(first.status).to.equal('passed');
    expect(second.status).to.equal('passed');
    expect(first.steps[0].title).to.equal('app.open /');
    expect(second.steps.at(-1).title).to.equal('expect.toHaveText getByRole("status")');
  });

  it('reports a flaky test as passed with retry count', () => {
    const test = findTest('passes on retry');
    expect(test.status).to.equal('passed');
    expect(test.meta.retryCount).to.equal(1);
    expect(test.meta.isFlaky).to.be.true;
  });

  it('adds target and browser to meta', () => {
    const { meta } = findTest('opens the app');
    expect(meta.target).to.equal('web');
    expect(meta.platform).to.equal('web');
    expect(meta.browser).to.match(/^chromium/);
  });
});
