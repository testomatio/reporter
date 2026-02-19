// Тест для проверки idempotent поведения createRun
import { expect } from 'chai';
import XmlReader from '../../src/xmlReader.js';
import { DebugPipe } from '../../src/pipe/debug.js';

describe('XmlReader.createRun idempotent behavior', () => {
  class MockPipeWithTracking extends DebugPipe {
    constructor() {
      super();
      this.createRunCalls = [];
      this.requestCalls = [];
    }

    async createRun(params) {
      this.createRunCalls.push(params);
      return super.createRun(params);
    }
  }

  const setupMockPipeWithTracking = () => {
    const pipe = new MockPipeWithTracking();
    pipe.isEnabled = true;
    pipe.runId = null;
    pipe.client = {
      request: async (opts) => {
        pipe.requestCalls.push(opts);
        // First call creates run
        if (opts.method === 'POST' && opts.url === '/api/reporter') {
          return {
            data: {
              uid: 'test-run-id-123',
              url: '/projects/1/runs/123',
              public_url: 'https://testomat.io/public/123'
            }
          };
        }
        // Subsequent calls update run
        if (opts.method === 'PUT' && opts.url.includes('/api/reporter/')) {
          return {
            data: {
              url: '/projects/1/runs/123',
              public_url: 'https://testomat.io/public/123'
            }
          };
        }
        return { data: {} };
      }
    };
    return pipe;
  };

  it('should not create duplicate runs if called multiple times', async () => {
    process.env.TESTOMATIO_DEBUG = '1';

    const reader = new XmlReader({
      apiKey: 'test-api-key',
    });

    reader.tests = [];
    reader.stats = {
      duration: 1000,
      tests_count: 0,
      passed_count: 0,
      failed_count: 0,
      skipped_count: 0,
      status: 'passed',
    };

    const mockPipe = setupMockPipeWithTracking();
    reader.pipes = [mockPipe];

    // First call
    await reader.createRun();
    expect(mockPipe.runId).to.equal('test-run-id-123');

    const postCallsAfterFirst = mockPipe.requestCalls.filter(c => c.method === 'POST');
    expect(postCallsAfterFirst.length).to.equal(1); // Created once

    // Second call
    await reader.createRun();
    expect(mockPipe.runId).to.equal('test-run-id-123'); // Same runId

    const postCallsAfterSecond = mockPipe.requestCalls.filter(c => c.method === 'POST');
    expect(postCallsAfterSecond.length).to.equal(1); // Still only one POST

    const putCallsAfterSecond = mockPipe.requestCalls.filter(c => c.method === 'PUT');
    expect(putCallsAfterSecond.length).to.equal(1); // Updated once

    // Third call
    await reader.createRun();

    const postCallsAfterThird = mockPipe.requestCalls.filter(c => c.method === 'POST');
    expect(postCallsAfterThird.length).to.equal(1); // Still only one POST

    const putCallsAfterThird = mockPipe.requestCalls.filter(c => c.method === 'PUT');
    expect(putCallsAfterThird.length).to.equal(2); // Updated twice

    console.log(`✅ createRun() called 3 times but only created 1 run`);
    console.log(`✅ POST (create): ${postCallsAfterThird.length} times`);
    console.log(`✅ PUT (update): ${putCallsAfterThird.length} times`);
  });
});
