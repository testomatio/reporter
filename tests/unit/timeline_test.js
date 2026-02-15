import { expect } from 'chai';
import TestomatioClient from '../../src/client.js';

describe('Timeline Data', () => {
  let client;
  let pipeAddCalls;

  beforeEach(() => {
    client = new TestomatioClient();
    client.runId = 'test-run-123';

    // Track calls to pipe.addTest
    pipeAddCalls = [];
  });

  describe('when timeline data is provided', () => {
    it('should pass timeline object to pipe', async () => {
      const testData = {
        title: 'Test Title',
        suite_title: 'Test Suite',
        status: 'passed',
        rid: 'test-123',
        timeline: {
          timestamp_start: 1234567890000,
          timestamp_finish: 1234567900000,
          worker_id: 'worker-1',
        },
      };

      // Mock pipes factory to capture data
      const testDataReceived = [];
      client.pipes = [
        {
          isEnabled: true,
          createRun: async () => {},
          addTest: async data => {
            testDataReceived.push(data);
          },
          finishRun: async () => {},
          toString: () => 'TestPipe',
        },
      ];

      await client.addTestRun('passed', testData);

      expect(testDataReceived).to.have.length(1);
      expect(testDataReceived[0]).to.have.property('timeline');
      expect(testDataReceived[0].timeline).to.deep.equal({
        timestamp_start: 1234567890000,
        timestamp_finish: 1234567900000,
        worker_id: 'worker-1',
      });
    });

    it('should pass timeline with only required fields', async () => {
      const testData = {
        title: 'Test Title',
        suite_title: 'Test Suite',
        status: 'passed',
        rid: 'test-123',
        timeline: {
          timestamp_start: 1234567890000,
          timestamp_finish: 1234567900000,
          // worker_id is optional
        },
      };

      const testDataReceived = [];
      client.pipes = [
        {
          isEnabled: true,
          createRun: async () => {},
          addTest: async data => {
            testDataReceived.push(data);
          },
          finishRun: async () => {},
          toString: () => 'TestPipe',
        },
      ];

      await client.addTestRun('passed', testData);

      expect(testDataReceived).to.have.length(1);
      expect(testDataReceived[0].timeline).to.deep.equal({
        timestamp_start: 1234567890000,
        timestamp_finish: 1234567900000,
      });
    });

    it('should pass timeline with project property', async () => {
      const testData = {
        title: 'Test Title',
        suite_title: 'Test Suite',
        status: 'passed',
        rid: 'test-123',
        timeline: {
          timestamp_start: 1234567890000,
          timestamp_finish: 1234567900000,
          worker_id: 'worker-1',
          project: 'chromium',
        },
      };

      const testDataReceived = [];
      client.pipes = [
        {
          isEnabled: true,
          createRun: async () => {},
          addTest: async data => {
            testDataReceived.push(data);
          },
          finishRun: async () => {},
          toString: () => 'TestPipe',
        },
      ];

      await client.addTestRun('passed', testData);

      expect(testDataReceived).to.have.length(1);
      expect(testDataReceived[0].timeline).to.deep.equal({
        timestamp_start: 1234567890000,
        timestamp_finish: 1234567900000,
        worker_id: 'worker-1',
        project: 'chromium',
      });
    });
  });

  describe('when timeline data is not provided', () => {
    it('should have timeline as undefined in test data', async () => {
      const testData = {
        title: 'Test Title',
        suite_title: 'Test Suite',
        status: 'passed',
        rid: 'test-123',
      };

      const testDataReceived = [];
      client.pipes = [
        {
          isEnabled: true,
          createRun: async () => {},
          addTest: async data => {
            testDataReceived.push(data);
          },
          finishRun: async () => {},
          toString: () => 'TestPipe',
        },
      ];

      await client.addTestRun('passed', testData);

      expect(testDataReceived).to.have.length(1);
      expect(testDataReceived[0]).to.have.property('timeline');
      expect(testDataReceived[0].timeline).to.be.undefined;
    });
  });

  describe('timeline timestamp validation', () => {
    it('should accept timestamps in microseconds', async () => {
      const currentMicroseconds = Date.now() * 1000;
      const testData = {
        title: 'Test Title',
        suite_title: 'Test Suite',
        status: 'passed',
        rid: 'test-123',
        timeline: {
          timestamp_start: currentMicroseconds - 1000000, // 1 second ago
          timestamp_finish: currentMicroseconds,
          worker_id: 'worker-1',
        },
      };

      const testDataReceived = [];
      client.pipes = [
        {
          isEnabled: true,
          createRun: async () => {},
          addTest: async data => {
            testDataReceived.push(data);
          },
          finishRun: async () => {},
          toString: () => 'TestPipe',
        },
      ];

      await client.addTestRun('passed', testData);

      expect(testDataReceived[0].timeline.timestamp_start).to.be.a('number');
      expect(testDataReceived[0].timeline.timestamp_finish).to.be.a('number');
      expect(testDataReceived[0].timeline.timestamp_finish).to.be.greaterThan(
        testDataReceived[0].timeline.timestamp_start,
      );
    });
  });
});
