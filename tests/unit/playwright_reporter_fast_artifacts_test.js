import { expect } from 'chai';
import path from 'path';
import PlaywrightReporter from '../../src/adapter/playwright.js';

describe('PlaywrightReporter fast artifacts', () => {
  it('waits for run creation before reporting a fast test with attachments', async () => {
    let resolveCreateRun;
    let runCreated = false;
    const createRunPromise = new Promise(resolve => {
      resolveCreateRun = () => {
        runCreated = true;
        resolve();
      };
    });
    const addTestRunCalls = [];

    const reporter = new PlaywrightReporter();
    reporter.client = {
      createRun: () => createRunPromise,
      addTestRun: async (status, data) => {
        if (!runCreated) throw new Error('addTestRun was called before createRun completed');
        addTestRunCalls.push({ status, data });
      },
      uploader: { isEnabled: true },
      updateRunStatus: async () => {},
    };

    reporter.onBegin({ outputDir: '', projects: [{ outputDir: '' }] }, {});

    const testEndPromise = reporter.onTestEnd(
      {
        title: 'fast test with artifact',
        id: 'fast-test',
        annotations: [],
        tags: [],
        expectedStatus: 'passed',
        location: { file: 'tests/fast.spec.js' },
        parent: {
          title: 'fast suite',
          project: () => ({
            dependencies: [],
            metadata: {},
            name: 'chromium',
            use: {},
          }),
        },
      },
      {
        attachments: [
          {
            body: Buffer.from('artifact'),
            contentType: 'image/png',
            name: 'screenshot',
          },
          {
            body: Buffer.from('video'),
            contentType: 'video/webm',
            name: 'video',
          },
        ],
        duration: 10,
        status: 'passed',
        stderr: [],
        stdout: [],
        steps: [],
      },
    );

    await Promise.resolve();
    expect(addTestRunCalls).to.have.length(0);

    resolveCreateRun();
    await testEndPromise;

    expect(addTestRunCalls).to.have.length(1);
    expect(addTestRunCalls[0].data.files).to.have.length(1);
    expect(addTestRunCalls[0].data.files[0].title).to.equal('screenshot');
    expect(addTestRunCalls[0].data.files[0].type).to.equal('image/png');

    await reporter.onEnd({ status: 'passed' });

    expect(addTestRunCalls).to.have.length(2);
    expect(addTestRunCalls[1].data.files).to.have.length(1);
    expect(addTestRunCalls[1].data.files[0].title).to.equal('fast test with artifact');
    expect(addTestRunCalls[1].data.files[0].type).to.equal('video/webm');
  });

  it('keeps automatic screenshots from hook and fixture steps as test-level artifacts', async () => {
    const screenshotPath = path.resolve('tests/unit/data/artifacts/screenshot1.png');
    const addTestRunCalls = [];
    const reporter = createReporter(addTestRunCalls);

    await reporter.onTestEnd(
      createTest('automatic screenshot'),
      createResult({
        attachments: [createScreenshot(screenshotPath)],
        steps: [
          {
            attachments: [createScreenshot(screenshotPath)],
            category: 'hook',
            duration: 1,
            steps: [],
            title: 'After Hooks',
          },
          {
            attachments: [createScreenshot(screenshotPath)],
            category: 'fixture',
            duration: 1,
            steps: [],
            title: 'Worker Cleanup',
          },
        ],
      }),
    );

    expect(addTestRunCalls).to.have.length(1);
    expect(addTestRunCalls[0].data.files).to.have.length(1);
    expect(addTestRunCalls[0].data.files[0].path).to.equal(screenshotPath);
    expect(addTestRunCalls[0].data.files[0].title).to.equal('screenshot');
    expect(addTestRunCalls[0].data.files[0].type).to.equal('image/png');
    for (const step of addTestRunCalls[0].data.steps) {
      expect(step).to.not.have.property('artifacts');
    }
  });

  it('keeps screenshots attached to test.step as step-level artifacts', async () => {
    const screenshotPath = path.resolve('tests/unit/data/artifacts/screenshot1.png');
    const addTestRunCalls = [];
    const reporter = createReporter(addTestRunCalls);

    await reporter.onTestEnd(
      createTest('step screenshot'),
      createResult({
        attachments: [createScreenshot(screenshotPath)],
        steps: [
          {
            attachments: [createScreenshot(screenshotPath)],
            category: 'test.step',
            duration: 1,
            steps: [],
            title: 'Check page rendering',
          },
        ],
      }),
    );

    expect(addTestRunCalls).to.have.length(1);
    expect(addTestRunCalls[0].data.steps[0].artifacts).to.deep.equal([screenshotPath]);
  });

  it('does not report Playwright test.attach as a framework step', async () => {
    const addTestRunCalls = [];
    const reporter = createReporter(addTestRunCalls);

    await reporter.onTestEnd(
      createTest('test attachment'),
      createResult({
        steps: [
          {
            category: 'test.attach',
            duration: 1,
            steps: [],
            title: 'Attach evidence',
          },
        ],
      }),
    );

    expect(addTestRunCalls).to.have.length(1);
    expect(addTestRunCalls[0].data.steps).to.equal(undefined);
  });
});

function createReporter(addTestRunCalls) {
  const reporter = new PlaywrightReporter();
  reporter.client = {
    addTestRun: async (status, data) => addTestRunCalls.push({ status, data }),
    uploader: { isEnabled: true },
  };
  return reporter;
}

function createTest(title) {
  return {
    annotations: [],
    expectedStatus: 'passed',
    id: title.replace(/\s+/g, '-'),
    location: { file: 'tests/artifacts.spec.js' },
    parent: {
      project: () => ({ dependencies: [], metadata: {}, name: 'chromium', use: {} }),
      title: 'artifacts suite',
    },
    tags: [],
    title,
  };
}

function createResult({ attachments = [], steps = [] } = {}) {
  return {
    attachments,
    duration: 10,
    status: 'failed',
    stderr: [],
    stdout: [],
    steps,
  };
}

function createScreenshot(screenshotPath) {
  return {
    contentType: 'image/png',
    name: 'screenshot',
    path: screenshotPath,
  };
}
