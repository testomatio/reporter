import { expect } from 'chai';
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
});
