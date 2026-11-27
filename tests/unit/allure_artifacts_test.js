import { expect } from 'chai';
import fs from 'fs';
import os from 'os';
import path from 'path';
import AllureReader from '../../src/allureReader.js';

// Assertions round-trip through JSON on purpose: reading `.link` off the link strings
// resolved to `String.prototype.link`, which stayed truthy and countable until the
// payload was serialized and every artifact turned into `null`.
describe('AllureReader artifacts', () => {
  let reader;
  let uploadedPaths;
  let savedEnv;

  // the AllureReader constructor turns these on globally and never restores them
  beforeEach(() => {
    savedEnv = {
      stack: process.env.TESTOMATIO_STACK_PASSED,
      steps: process.env.TESTOMATIO_STEPS_PASSED,
    };

    reader = new AllureReader({ apiKey: 'test-api-key' });
    reader.runId = 'run-1';
    uploadedPaths = [];
  });

  afterEach(() => {
    if (savedEnv.stack === undefined) delete process.env.TESTOMATIO_STACK_PASSED;
    else process.env.TESTOMATIO_STACK_PASSED = savedEnv.stack;

    if (savedEnv.steps === undefined) delete process.env.TESTOMATIO_STEPS_PASSED;
    else process.env.TESTOMATIO_STEPS_PASSED = savedEnv.steps;
  });

  function stubUploader(resolve) {
    reader.uploader = {
      uploadFileByPath: async (filePath, pathInS3) => {
        uploadedPaths.push({ filePath, pathInS3 });
        return resolve(filePath);
      },
    };
  }

  it('sends uploaded links, not nulls, in the serialized payload', async () => {
    const test = {
      rid: 'rid-1',
      title: 'testCanChangeMeasurementSystem',
      files: ['/results/a.png', '/results/b.png', '/results/c.txt'],
    };
    reader._tests = [test];
    stubUploader(filePath => `https://bucket.s3.amazonaws.com${filePath}`);

    await reader.uploadArtifacts();

    const payload = JSON.parse(JSON.stringify(test));
    expect(payload.artifacts).to.deep.equal([
      'https://bucket.s3.amazonaws.com/results/a.png',
      'https://bucket.s3.amazonaws.com/results/b.png',
      'https://bucket.s3.amazonaws.com/results/c.txt',
    ]);
    expect(payload.files).to.be.undefined;
  });

  it('drops artifacts that were skipped or failed to upload', async () => {
    const test = {
      rid: 'rid-2',
      title: 'partial upload',
      files: ['/results/a.png', '/results/too-big.zip'],
    };
    reader._tests = [test];
    stubUploader(filePath => {
      if (filePath.endsWith('.zip')) return undefined;
      return `https://bucket.s3.amazonaws.com${filePath}`;
    });

    await reader.uploadArtifacts();

    expect(JSON.parse(JSON.stringify(test)).artifacts).to.deep.equal([
      'https://bucket.s3.amazonaws.com/results/a.png',
    ]);
  });

  it('replaces nested step artifact paths with uploaded links', async () => {
    const test = {
      rid: 'rid-3',
      title: 'step attachments',
      files: ['/results/test-level.png'],
      steps: [
        {
          title: 'outer',
          artifacts: ['/results/step-1.png'],
          steps: [{ title: 'inner', artifacts: ['/results/step-2.png'] }],
        },
      ],
    };
    reader._tests = [test];
    stubUploader(filePath => `https://bucket.s3.amazonaws.com${filePath}`);

    await reader.uploadArtifacts();

    const payload = JSON.parse(JSON.stringify(test));
    // step artifacts render inline in the step tree and stay out of the test-level list
    expect(payload.artifacts).to.deep.equal(['https://bucket.s3.amazonaws.com/results/test-level.png']);
    expect(payload.steps[0].artifacts).to.deep.equal(['https://bucket.s3.amazonaws.com/results/step-1.png']);
    expect(payload.steps[0].steps[0].artifacts).to.deep.equal(['https://bucket.s3.amazonaws.com/results/step-2.png']);
    expect(uploadedPaths).to.have.lengthOf(3);
  });

  it('drops step artifacts that failed to upload instead of leaving local paths', async () => {
    const test = {
      rid: 'rid-4',
      title: 'failed step upload',
      steps: [{ title: 'outer', artifacts: ['/results/step-1.png'] }],
    };
    reader._tests = [test];
    stubUploader(() => undefined);

    await reader.uploadArtifacts();

    expect(JSON.parse(JSON.stringify(test)).steps[0]).to.not.have.property('artifacts');
  });

  it('collects step attachments from allure results', () => {
    const resultsDir = path.join(os.tmpdir(), `allure-artifacts-${process.pid}`);
    fs.mkdirSync(resultsDir, { recursive: true });
    fs.writeFileSync(path.join(resultsDir, 'shot.png'), 'x');
    fs.writeFileSync(path.join(resultsDir, 'page.html'), 'x');

    const test = reader.processAllureResult(
      {
        uuid: 'rid-5',
        name: 'with step attachments',
        status: 'failed',
        attachments: [{ source: 'page.html' }],
        steps: [
          {
            name: 'outer',
            status: 'failed',
            steps: [{ name: 'inner', status: 'failed', attachments: [{ source: 'shot.png' }] }],
          },
        ],
      },
      resultsDir,
    );

    expect(test.files).to.deep.equal([path.join(resultsDir, 'page.html')]);
    expect(test.steps[0].steps[0].artifacts).to.deep.equal([path.join(resultsDir, 'shot.png')]);

    fs.rmSync(resultsDir, { recursive: true, force: true });
  });
});
