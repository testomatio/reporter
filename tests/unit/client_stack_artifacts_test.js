import { expect } from 'chai';
import TestomatioClient from '../../src/client.js';

describe('Client Stack Artifacts', () => {
  let client;
  let uploadCalls;

  beforeEach(() => {
    client = new TestomatioClient();
    client.runId = 'test-run-123';
    uploadCalls = [];

    client.uploader.uploadFileAsBuffer = async (buffer, path) => {
      uploadCalls.push({ buffer, path });
      return 'https://test-bucket.s3.amazonaws.com/artifact';
    };
  });

  afterEach(() => {
    delete process.env.TESTOMATIO_STACK_ARTIFACTS;
  });

  describe('when TESTOMATIO_STACK_ARTIFACTS is disabled', () => {
    it('should not upload artifacts', async () => {
      const testData = {
        title: 'Test Title',
        suite_title: 'Test Suite',
        error: new Error('Test error'),
        steps: [],
        logs: 'A'.repeat(50000), // Make it much larger to exceed truncation limits
        rid: 'test-123'
      };

      await client.addTestRun('failed', testData);

      expect(uploadCalls).to.have.length(0);
    });
  });

  describe('when TESTOMATIO_STACK_ARTIFACTS is enabled', () => {
    beforeEach(() => {
      process.env.TESTOMATIO_STACK_ARTIFACTS = '1';
    });

    it('should upload logs artifact when logs are large', async () => {
      const testData = {
        title: 'Test Title',
        suite_title: 'Test Suite',
        error: new Error('Test error'),
        steps: [{ title: 'Step 1', duration: 100 }],
        logs: 'A'.repeat(50000), // Make it much larger to exceed truncation limits
        rid: 'test-123'
      };

      await client.addTestRun('failed', testData);

      expect(uploadCalls).to.have.length(1);
      expect(uploadCalls[0].path[0]).to.equal('test-run-123');
      expect(uploadCalls[0].path[1]).to.equal('test-123');
      expect(uploadCalls[0].path[2]).to.match(/^logs_\d+\.log$/);
    });

    
    it('should upload only logs artifact when both logs and steps are large', async () => {
      const largeSteps = Array(200).fill().map((_, i) => ({
        title: `Very long step title that takes up a lot of characters ${i}`,
        duration: 100
      }));

      const testData = {
        title: 'Test Title',
        suite_title: 'Test Suite',
        error: new Error('Test error'),
        steps: largeSteps,
        logs: 'A'.repeat(50000), // Make it much larger to exceed truncation limits
        rid: 'test-123'
      };

      await client.addTestRun('failed', testData);

      expect(uploadCalls).to.have.length(1);
      expect(uploadCalls[0].path[2]).to.match(/^logs_\d+\.log$/);
    });

    it('should strip ANSI codes from uploaded logs', async () => {
      // Create logs with ANSI color codes
      const error = new Error('Colored error');
      error.stack = '\x1b[31mRed stack trace\x1b[0m';
      const steps = [{ title: '\x1b[32mGreen step\x1b[0m', duration: 100 }];
      const logs = '\x1b[33mYellow logs\x1b[0m';

      // Create logs that will exceed 500 chars even after truncation
      // Each line will be truncated to 255 chars, so we need at least 3 lines to exceed 500
      const largeLogs = [
        '\x1b[33mLine 1 with ANSI codes: ' + 'A'.repeat(300) + '\x1b[0m',
        '\x1b[32mLine 2 with ANSI codes: ' + 'B'.repeat(300) + '\x1b[0m',
        '\x1b[31mLine 3 with ANSI codes: ' + 'C'.repeat(300) + '\x1b[0m',
      ].join('\n');

      const testData = {
        title: 'Test Title',
        suite_title: 'Test Suite',
        error,
        steps,
        logs: largeLogs, // Large logs with ANSI codes to trigger upload
        rid: 'test-123'
      };

      await client.addTestRun('failed', testData);

      expect(uploadCalls).to.have.length(1);

      // Check that the uploaded file contains no ANSI escape sequences
      const uploadedBuffer = uploadCalls[0].buffer;
      const uploadedContent = uploadedBuffer.toString('utf8');

      // Should not contain ANSI escape sequences
      expect(uploadedContent).to.not.match(/\x1b\[[0-9;]*m/);

      // Should contain the actual content (without ANSI codes)
      expect(uploadedContent).to.include('Line 1 with ANSI codes:');
      expect(uploadedContent).to.include('Line 2 with ANSI codes:');
      expect(uploadedContent).to.include('Line 3 with ANSI codes:');
      expect(uploadedContent).to.include('AAA'); // truncated content should still have some A's
    });

    it('should not upload artifacts when content is small', async () => {
      const testData = {
        title: 'Test Title',
        suite_title: 'Test Suite',
        error: null,
        steps: [{ title: 'Step 1', duration: 100 }],
        logs: 'Small logs',
        rid: 'test-123'
      };

      await client.addTestRun('failed', testData);

      expect(uploadCalls).to.have.length(0);
    });
  });
});