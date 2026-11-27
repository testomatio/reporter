import { expect } from 'chai';
import AllureReader from '../../src/allureReader.js';
import TestomatioPipe from '../../src/pipe/testomatio.js';

/**
 * Verifies that AllureReader uploads large suites using the same size-based
 * chunking as XmlReader (BATCH_MODE.MANUAL, one batch request per chunk) and
 * that every test is sent exactly once — no loss, no double-send.
 */
describe('AllureReader Chunking with Pipe API', () => {
  let reader;
  let testomatioPipe;
  let httpCalls;
  let savedEnv;

  // AllureReader's constructor opts passed tests into sending steps/stack by setting
  // these global env vars. Save and restore them so this unit test stays isolated and
  // does not leak the flags into sibling suites.
  beforeEach(() => {
    savedEnv = {
      stack: process.env.TESTOMATIO_STACK_PASSED,
      steps: process.env.TESTOMATIO_STEPS_PASSED,
    };

    reader = new AllureReader({ apiKey: 'test-api-key' });

    // isolate the chunked-upload path from artifact/source-code concerns
    reader.uploadArtifacts = async () => {};
    reader.fetchSourceCode = () => {};

    testomatioPipe = new TestomatioPipe({
      apiKey: 'test-api-key',
      url: 'https://test.testomat.io',
      batchMode: 'manual',
    });

    testomatioPipe.runId = 'test-run-123';
    testomatioPipe.store.runId = 'test-run-123';

    httpCalls = [];

    testomatioPipe.client.request = async ({ method, url, data }) => {
      httpCalls.push({
        method,
        url,
        testCount: data?.tests?.length || 0,
        batchIndex: data?.batch_index,
        titles: data?.tests?.map(t => t.title) || [],
        status: data?.status,
      });

      if (url.includes('/reporter') && method === 'POST' && !url.includes('/testrun')) {
        return { data: { uid: 'test-run-id', url: '/test/test-run' } };
      }

      return { data: {} };
    };

    reader.pipes = [testomatioPipe];
  });

  afterEach(() => {
    const restore = (key, value) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    };
    restore('TESTOMATIO_STACK_PASSED', savedEnv.stack);
    restore('TESTOMATIO_STEPS_PASSED', savedEnv.steps);
  });

  const makeTests = (count, bytes = 50_000) =>
    Array.from({ length: count }, (_, i) => ({
      rid: `rid-${i}`,
      title: `Test ${i}`,
      status: i % 3 === 0 ? 'failed' : 'passed',
      stack: 'x'.repeat(bytes),
    }));

  const batchUploads = () => httpCalls.filter(c => c.url.includes('/testrun'));

  it('splits a 1000-test suite into multiple batches', async () => {
    reader.tests = makeTests(1000);

    await reader.uploadData();

    expect(batchUploads().length, 'should produce more than one batch').to.be.greaterThan(1);
  });

  it('uploads every test exactly once (no loss, no double-send)', async () => {
    reader.tests = makeTests(1000);

    await reader.uploadData();

    const uploaded = batchUploads();
    const totalUploaded = uploaded.reduce((sum, c) => sum + c.testCount, 0);
    expect(totalUploaded, 'total tests across all batches').to.equal(1000);

    // each unique title appears exactly once across all batches
    const allTitles = uploaded.flatMap(c => c.titles);
    expect(allTitles).to.have.length(1000);
    expect(new Set(allTitles).size, 'no duplicate titles sent').to.equal(1000);
  });

  it('uses sequential batch indices', async () => {
    reader.tests = makeTests(1000);

    await reader.uploadData();

    const indices = batchUploads().map(c => c.batchIndex);
    indices.forEach((idx, i) => {
      expect(idx).to.equal(i + 1);
    });
  });

  it('keeps a small suite in a single batch', async () => {
    reader.tests = makeTests(5, 100);

    await reader.uploadData();

    expect(batchUploads()).to.have.length(1);
    expect(batchUploads()[0].testCount).to.equal(5);
  });

  it('finishes the run exactly once after all batches', async () => {
    reader.tests = makeTests(500);

    await reader.uploadData();

    const finishCalls = httpCalls.filter(c => c.method === 'PUT');
    expect(batchUploads().length).to.be.greaterThan(0);
    expect(finishCalls.length).to.equal(1);
  });

  it('finishes the run and sends no batches for an empty suite', async () => {
    reader.tests = [];

    await reader.uploadData();

    expect(batchUploads()).to.have.length(0);
    expect(httpCalls.filter(c => c.method === 'PUT')).to.have.length(1);
  });
});
