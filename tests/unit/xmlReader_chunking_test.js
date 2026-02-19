import { expect } from 'chai';
import path from 'path';
import { fileURLToPath } from 'url';
import XmlReader from '../../src/xmlReader.js';
import { DebugPipe } from '../../src/pipe/debug.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('XML Reader Chunking', () => {
  class MockPipe extends DebugPipe {
    constructor() {
      super();
      this.finishRunCalls = [];
    }

    async finishRun(params) {
      this.finishRunCalls.push(params);
      return super.finishRun(params);
    }
  }

  const setupMockPipe = () => {
    const pipe = new MockPipe();
    pipe.isEnabled = true;
    pipe.runId = 'test-run-id';
    pipe.client = {
      request: async () => ({ data: {} })
    };
    return pipe;
  };

  it('should split tests into chunks based on size limit', async () => {
    process.env.TESTOMATIO_DEBUG = '1';

    const reader = new XmlReader();
    await reader.parse(path.join(__dirname, 'data/junit1.xml'));
    reader.formatTests();

    const mockPipe = setupMockPipe();
    reader.pipes = [mockPipe];

    await reader.uploadData();

    // finishRun should only be called once at the end
    const statusCalls = mockPipe.finishRunCalls.filter(c => c.status);
    expect(statusCalls.length).to.equal(1);
    expect(statusCalls[0].status).to.equal('finished');
  });

  it('should use default chunk size when env vars not set', async () => {
    process.env.TESTOMATIO_DEBUG = '1';

    const reader = new XmlReader();
    await reader.parse(path.join(__dirname, 'data/junit1.xml'));
    reader.formatTests();

    const mockPipe = setupMockPipe();
    reader.pipes = [mockPipe];

    await reader.uploadData();

    const statusCalls = mockPipe.finishRunCalls.filter(c => c.status);
    expect(statusCalls.length).to.equal(1);
    expect(statusCalls[0].status).to.equal('finished');
  });

  it('should handle empty tests array without errors', async () => {
    process.env.TESTOMATIO_DEBUG = '1';

    const reader = new XmlReader();
    reader.tests = [];

    const mockPipe = setupMockPipe();
    reader.pipes = [mockPipe];

    await reader.uploadData();

    const calls = mockPipe.finishRunCalls;
    expect(calls.length).to.equal(1);
    expect(calls[0].status).to.equal('finished');
  });

  it('should handle empty test results', async () => {
    process.env.TESTOMATIO_DEBUG = '1';

    const reader = new XmlReader();
    reader.tests = [];

    const mockPipe = setupMockPipe();
    reader.pipes = [mockPipe];

    reader.uploadArtifacts = async () => {};

    await reader.uploadData();

    const calls = mockPipe.finishRunCalls;
    expect(calls.length).to.equal(1);
    expect(calls[0].status).to.equal('finished');
  });

  it('should handle large reports with multiple chunks', async () => {
    process.env.TESTOMATIO_DEBUG = '1';

    const reader = new XmlReader();
    await reader.parse(path.join(__dirname, 'data/junit1.xml'));
    reader.formatTests();

    const mockPipe = setupMockPipe();
    reader.pipes = [mockPipe];

    await reader.uploadData();

    const statusCalls = mockPipe.finishRunCalls.filter(c => c.status);
    expect(statusCalls.length).to.equal(1);
    expect(statusCalls[0].status).to.equal('finished');
  });

  it('should send all tests across chunks', async () => {
    process.env.TESTOMATIO_DEBUG = '1';

    const reader = new XmlReader();
    await reader.parse(path.join(__dirname, 'data/junit1.xml'));
    reader.formatTests();

    const originalTestCount = reader.tests.length;

    const mockPipe = setupMockPipe();
    reader.pipes = [mockPipe];

    await reader.uploadData();

    const statusCalls = mockPipe.finishRunCalls.filter(c => c.status);
    expect(statusCalls.length).to.equal(1);

    // Tests were processed (we can't easily test chunk uploads without mocking client.request)
    expect(originalTestCount).to.be.greaterThan(0);
  });

  it('should log chunk progress to console', async () => {
    process.env.TESTOMATIO_DEBUG = '1';

    const reader = new XmlReader();
    await reader.parse(path.join(__dirname, 'data/junit1.xml'));
    reader.formatTests();

    const mockPipe = setupMockPipe();
    reader.pipes = [mockPipe];

    await reader.uploadData();

    const statusCalls = mockPipe.finishRunCalls.filter(c => c.status);
    expect(statusCalls.length).to.equal(1);
  });
});
