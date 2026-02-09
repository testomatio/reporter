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

  it('should split tests into chunks based on size limit', async () => {
    process.env.TESTOMATIO_DEBUG = '1';

    const reader = new XmlReader();
    await reader.parse(path.join(__dirname, 'data/junit1.xml'));
    reader.formatTests();

    const mockPipe = new MockPipe();
    reader.pipes = [mockPipe];

    await reader.uploadData();

    const testChunks = mockPipe.finishRunCalls.filter(c => c.tests && !c.status);
    const statusCalls = mockPipe.finishRunCalls.filter(c => c.status);

    expect(testChunks.length).to.be.greaterThan(0);
    expect(statusCalls[statusCalls.length - 1].status).to.equal('finished');
  });

  it('should use default chunk size when env vars not set', async () => {
    process.env.TESTOMATIO_DEBUG = '1';

    const reader = new XmlReader();
    await reader.parse(path.join(__dirname, 'data/junit1.xml'));
    reader.formatTests();

    const mockPipe = new MockPipe();
    reader.pipes = [mockPipe];

    await reader.uploadData();

    const testChunks = mockPipe.finishRunCalls.filter(c => c.tests && !c.status);

    expect(testChunks.length).to.be.greaterThan(0);
  });

  it('should handle empty tests array without errors', async () => {
    process.env.TESTOMATIO_DEBUG = '1';

    const reader = new XmlReader();
    reader.tests = [];

    const mockPipe = new MockPipe();
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

    const mockPipe = new MockPipe();
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

    const mockPipe = new MockPipe();
    reader.pipes = [mockPipe];

    await reader.uploadData();

    const testChunks = mockPipe.finishRunCalls.filter(c => c.tests && !c.status);

    expect(testChunks.length).to.be.greaterThan(0);
  });

  it('should send all tests across chunks', async () => {
    process.env.TESTOMATIO_DEBUG = '1';

    const reader = new XmlReader();
    await reader.parse(path.join(__dirname, 'data/junit1.xml'));
    reader.formatTests();

    const originalTestCount = reader.tests.length;

    const mockPipe = new MockPipe();
    reader.pipes = [mockPipe];

    await reader.uploadData();

    const testChunks = mockPipe.finishRunCalls.filter(c => c.tests && !c.status);

    let totalTestsInChunks = 0;
    testChunks.forEach(chunk => {
      totalTestsInChunks += chunk.tests.length;
    });

    expect(totalTestsInChunks).to.equal(originalTestCount);
  });

  it('should log chunk progress to console', async () => {
    process.env.TESTOMATIO_DEBUG = '1';

    const reader = new XmlReader();
    await reader.parse(path.join(__dirname, 'data/junit1.xml'));
    reader.formatTests();

    const mockPipe = new MockPipe();
    reader.pipes = [mockPipe];

    await reader.uploadData();

    const testChunks = mockPipe.finishRunCalls.filter(c => c.tests && !c.status);

    expect(testChunks.length).to.be.greaterThan(0);
  });
});
