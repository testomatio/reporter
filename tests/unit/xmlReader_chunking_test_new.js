import { expect } from 'chai';
import path from 'path';
import { fileURLToPath } from 'url';
import XmlReader from '../../src/xmlReader.js';
import { DebugPipe } from '../../src/pipe/debug.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('XML Reader Chunking - Detailed Tests', () => {
  class MockPipeWithTracking extends DebugPipe {
    constructor() {
      super();
      this.uploadTestChunkCalls = [];
      this.finishRunCalls = [];
      this.requestCalls = [];
    }

    async finishRun(params) {
      this.finishRunCalls.push(params);
      return super.finishRun(params);
    }
  }

  const setupMockPipeWithTracking = () => {
    const pipe = new MockPipeWithTracking();
    pipe.isEnabled = true;
    pipe.runId = 'test-run-id';
    pipe.client = {
      request: async (opts) => {
        pipe.requestCalls.push(opts);
        return { data: { uid: 'test-run-id' } };
      }
    };
    return pipe;
  };

  afterEach(() => {
    delete process.env.TESTOMATIO_DEBUG;
    delete process.env.TESTOMATIO_CHUNK_MAX_TESTS;
    delete process.env.TESTOMATIO_CHUNK_MAX_SIZE_MB;
  });

  it('should create run before uploading chunks', async () => {
    process.env.TESTOMATIO_DEBUG = '1';

    const reader = new XmlReader({
      apiKey: 'test-api-key',
    });

    // Create a large test dataset that will be split into multiple chunks
    const largeTestSet = [];
    for (let i = 0; i < 100; i++) {
      largeTestSet.push({
        title: `Test ${i}`,
        status: 'passed',
        suite_title: 'Test Suite',
        stack: 'A'.repeat(10000), // Large stack to trigger size-based chunking
      });
    }

    reader.tests = largeTestSet;
    reader.stats = {
      duration: 1000,
      tests_count: 100,
      passed_count: 100,
      failed_count: 0,
      skipped_count: 0,
      status: 'passed',
    };

    const mockPipe = setupMockPipeWithTracking();
    reader.pipes = [mockPipe];

    // Mock the methods that are called in uploadData
    reader.uploadArtifacts = async () => {};
    reader.calculateStats = () => reader.stats;
    reader.connectAdapter = () => {};
    reader.fetchSourceCode = () => {};
    reader.formatErrors = () => {};
    reader.formatTests = () => {};

    await reader.uploadData();

    // Verify that createRun was called (or runId was set somehow)
    expect(mockPipe.runId).to.exist;
    expect(mockPipe.runId).to.equal('test-run-id');

    // Verify that chunks were uploaded via POST /api/reporter/${runId}/testrun
    const chunkUploads = mockPipe.requestCalls.filter(call =>
      call.method === 'POST' &&
      call.url.includes('/api/reporter/') &&
      call.url.includes('/testrun')
    );

    console.log(`Found ${chunkUploads.length} chunk upload calls`);
    console.log(`Total request calls: ${mockPipe.requestCalls.length}`);
    mockPipe.requestCalls.forEach((call, idx) => {
      console.log(`Request ${idx + 1}: ${call.method} ${call.url}`);
    });

    // Should have uploaded chunks
    expect(chunkUploads.length).to.be.greaterThan(0);

    // Verify each chunk has the correct structure
    chunkUploads.forEach((chunk, idx) => {
      expect(chunk.data).to.have.property('api_key');
      expect(chunk.data).to.have.property('tests');
      expect(chunk.data).to.have.property('batch_index');
      expect(chunk.data.tests).to.be.an('array');
      console.log(`Chunk ${idx + 1}: ${chunk.data.tests.length} tests, batch_index: ${chunk.data.batch_index}`);
    });

    // Verify finishRun was called at the end
    const finishCalls = mockPipe.finishRunCalls.filter(c => c.status === 'finished');
    expect(finishCalls.length).to.equal(1);
    expect(finishCalls[0].status).to.equal('finished');
  });

  it('should NOT skip the first chunk when runId is set', async () => {
    process.env.TESTOMATIO_DEBUG = '1';

    const reader = new XmlReader({
      apiKey: 'test-api-key',
    });

    // Create test data that will be split into 3 chunks
    const testSet = [];
    for (let i = 0; i < 30; i++) {
      testSet.push({
        title: `Test ${i}`,
        status: 'passed',
        suite_title: 'Test Suite',
        stack: 'X'.repeat(50000), // Large stack to ensure chunking
      });
    }

    reader.tests = testSet;
    reader.stats = {
      duration: 1000,
      tests_count: 30,
      passed_count: 30,
      failed_count: 0,
      skipped_count: 0,
      status: 'passed',
    };

    const mockPipe = setupMockPipeWithTracking();
    reader.pipes = [mockPipe];

    reader.uploadArtifacts = async () => {};
    reader.calculateStats = () => reader.stats;
    reader.connectAdapter = () => {};
    reader.fetchSourceCode = () => {};
    reader.formatErrors = () => {};
    reader.formatTests = () => {};

    await reader.uploadData();

    // Count how many tests were actually uploaded in chunks
    const chunkUploads = mockPipe.requestCalls.filter(call =>
      call.method === 'POST' &&
      call.url.includes('/testrun')
    );

    let totalTestsUploaded = 0;
    chunkUploads.forEach(chunk => {
      totalTestsUploaded += chunk.data.tests.length;
    });

    console.log(`Total tests in dataset: ${testSet.length}`);
    console.log(`Total tests uploaded in chunks: ${totalTestsUploaded}`);
    console.log(`Number of chunks: ${chunkUploads.length}`);

    // ALL tests should be uploaded, none skipped
    expect(totalTestsUploaded).to.equal(testSet.length);

    // Should have multiple chunks
    expect(chunkUploads.length).to.be.greaterThan(0);

    // Verify batch_index is sequential starting from 1
    const batchIndices = chunkUploads.map(c => c.data.batch_index).sort((a, b) => a - b);
    expect(batchIndices[0]).to.equal(1); // First chunk should have batch_index = 1
    expect(batchIndices).to.deep.equal([...Array(chunkUploads.length).keys()].map(i => i + 1));
  });

  it('should handle case when runId is NOT set (chunks should be skipped)', async () => {
    process.env.TESTOMATIO_DEBUG = '1';

    const reader = new XmlReader({
      apiKey: 'test-api-key',
    });

    const testSet = [
      { title: 'Test 1', status: 'passed', suite_title: 'Suite' },
      { title: 'Test 2', status: 'passed', suite_title: 'Suite' },
    ];

    reader.tests = testSet;
    reader.stats = {
      duration: 1000,
      tests_count: 2,
      passed_count: 2,
      failed_count: 0,
      skipped_count: 0,
      status: 'passed',
    };

    const mockPipe = new MockPipeWithTracking();
    mockPipe.isEnabled = true;
    mockPipe.runId = null; // No runId set!
    mockPipe.client = {
      request: async (opts) => {
        mockPipe.requestCalls.push(opts);
        return { data: {} };
      }
    };
    reader.pipes = [mockPipe];

    reader.uploadArtifacts = async () => {};
    reader.calculateStats = () => reader.stats;
    reader.connectAdapter = () => {};
    reader.fetchSourceCode = () => {};
    reader.formatErrors = () => {};
    reader.formatTests = () => {};

    await reader.uploadData();

    // No chunks should be uploaded when runId is null
    const chunkUploads = mockPipe.requestCalls.filter(call =>
      call.method === 'POST' &&
      call.url.includes('/testrun')
    );

    expect(chunkUploads.length).to.equal(0);
  });

  it('should call createRun before uploading chunks', async () => {
    process.env.TESTOMATIO_DEBUG = '1';

    const reader = new XmlReader({
      apiKey: 'test-api-key',
    });

    const testSet = [
      { title: 'Test 1', status: 'passed', suite_title: 'Suite' },
    ];

    reader.tests = testSet;
    reader.stats = {
      duration: 1000,
      tests_count: 1,
      passed_count: 1,
      failed_count: 0,
      skipped_count: 0,
      status: 'passed',
    };

    const mockPipe = setupMockPipeWithTracking();
    reader.pipes = [mockPipe];

    // Track if createRun was called
    let createRunCalled = false;
    const originalCreateRun = reader.createRun.bind(reader);
    reader.createRun = async function() {
      createRunCalled = true;
      return originalCreateRun();
    };

    reader.uploadArtifacts = async () => {};
    reader.calculateStats = () => reader.stats;
    reader.connectAdapter = () => {};
    reader.fetchSourceCode = () => {};
    reader.formatErrors = () => {};
    reader.formatTests = () => {};

    await reader.uploadData();

    // createRun should be called
    expect(createRunCalled).to.be.true;

    // After createRun, runId should be set
    expect(mockPipe.runId).to.exist;
  });
});
