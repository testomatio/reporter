import { expect } from 'chai';
import fs from 'fs';
import path from 'path';
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

  it('uploads step artifacts into steps and excludes them from test artifacts', async () => {
    const pipeCalls = [];
    client.pipes = [
      {
        isEnabled: true,
        toString: () => 'FakePipe',
        addTest: async data => {
          pipeCalls.push(data);
        },
      },
    ];

    client.uploader.isEnabled = true;
    client.uploader.uploadFileByPath = async (filePath, s3Path) => {
      uploadCalls.push({ filePath, path: s3Path });
      return `https://bucket.example/${s3Path.join('/')}`;
    };

    await client.addTestRun('failed', {
      rid: 'test-rid',
      test_id: '@T123',
      title: 'Test with step artifact',
      suite_title: 'Suite',
      files: [
        { path: 'logs/test/test_1.jpg' },
        { path: 'logs/step/Step_1.jpg' },
      ],
      steps: [
        {
          title: 'Parent step',
          artifacts: ['logs/step/Step_1.jpg'],
          steps: [
            {
              title: 'Nested step',
              artifacts: [{ path: 'logs/step/Step_2.jpg' }],
            },
          ],
        },
      ],
    });

    expect(uploadCalls).to.have.length(3);
    expect(uploadCalls[0].path).to.deep.equal([
      'test-run-123',
      'test-rid',
      'steps',
      'Step_1.jpg',
    ]);
    expect(uploadCalls[1].path).to.deep.equal([
      'test-run-123',
      'test-rid',
      'steps',
      'Step_2.jpg',
    ]);
    expect(uploadCalls[2].path).to.deep.equal(['test-run-123', 'test-rid', 'test_1.jpg']);

    expect(pipeCalls).to.have.length(1);
    expect(pipeCalls[0].artifacts).to.deep.equal(['https://bucket.example/test-run-123/test-rid/test_1.jpg']);
    expect(pipeCalls[0].steps[0].artifacts).to.deep.equal([
      'https://bucket.example/test-run-123/test-rid/steps/Step_1.jpg',
    ]);
    expect(pipeCalls[0].steps[0].steps[0].artifacts).to.deep.equal([
      'https://bucket.example/test-run-123/test-rid/steps/Step_2.jpg',
    ]);
  });

  it('keeps constructor pipe config when createRun receives runtime params', async () => {
    const reportDir = path.join('output', 'report');
    const reportRoot = path.resolve(process.cwd(), 'output');
    const htmlClient = new TestomatioClient({ html: true, reportDir });

    try {
      await htmlClient.createRun({ title: 'Runtime title' });

      const htmlPipe = htmlClient.pipes.find(pipe => pipe.constructor.name === 'HtmlPipe');

      expect(htmlPipe).to.exist;
      expect(htmlPipe.isEnabled).to.equal(true);
      expect(htmlPipe.htmlReportDir).to.equal(reportDir);
    } finally {
      await fs.promises.rm(reportRoot, { recursive: true, force: true });
    }
  });

  describe('when TESTOMATIO_STACK_ARTIFACTS is disabled', () => {
    it('should not upload artifacts', async () => {
      const testData = {
        title: 'Test Title',
        suite_title: 'Test Suite',
        error: new Error('Test error'),
        steps: [],
        logs: 'A'.repeat(50000), // Make it much larger to exceed truncation limits
        rid: 'test-123',
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
        rid: 'test-123',
      };

      await client.addTestRun('failed', testData);

      expect(uploadCalls).to.have.length(1);
      expect(uploadCalls[0].path[0]).to.equal('test-run-123');
      expect(uploadCalls[0].path[1]).to.equal('test-123');
      expect(uploadCalls[0].path[2]).to.match(/^logs_\d+\.log$/);
    });

    it('should upload only logs artifact when both logs and steps are large', async () => {
      const largeSteps = Array(200)
        .fill()
        .map((_, i) => ({
          title: `Very long step title that takes up a lot of characters ${i}`,
          duration: 100,
        }));

      const testData = {
        title: 'Test Title',
        suite_title: 'Test Suite',
        error: new Error('Test error'),
        steps: largeSteps,
        logs: 'A'.repeat(50000), // Make it much larger to exceed truncation limits
        rid: 'test-123',
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
        rid: 'test-123',
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

    it('should upload artifacts even when content is small', async () => {
      const testData = {
        title: 'Test Title',
        suite_title: 'Test Suite',
        error: null,
        steps: [{ title: 'Step 1', duration: 100 }],
        logs: 'Small logs',
        rid: 'test-123',
      };

      await client.addTestRun('failed', testData);

      expect(uploadCalls).to.have.length(1);
      expect(uploadCalls[0].path[0]).to.equal('test-run-123');
      expect(uploadCalls[0].path[1]).to.equal('test-123');
      expect(uploadCalls[0].path[2]).to.match(/^logs_\d+\.log$/);

      // Check that the uploaded file contains the logs
      const uploadedBuffer = uploadCalls[0].buffer;
      const uploadedContent = uploadedBuffer.toString('utf8');
      expect(uploadedContent).not.to.include('Step 1');
      expect(uploadedContent).to.include('Small logs');
    });

    it('should upload logs artifacts for passed tests when enabled', async () => {
      // Create large logs for a passed test
      const largeLogs = [
        '\x1b[33mPassed test log line 1: ' + 'A'.repeat(300) + '\x1b[0m',
        '\x1b[32mPassed test log line 2: ' + 'B'.repeat(300) + '\x1b[0m',
        '\x1b[36mPassed test log line 3: ' + 'C'.repeat(300) + '\x1b[0m',
      ].join('\n');

      const testData = {
        title: 'Passed Test Title',
        suite_title: 'Test Suite',
        error: null, // No error for passed test
        steps: [{ title: 'Successful step', duration: 100 }],
        logs: largeLogs,
        rid: 'test-123',
      };

      await client.addTestRun('passed', testData);

      expect(uploadCalls).to.have.length(1);
      expect(uploadCalls[0].path[2]).to.match(/^logs_\d+\.log$/);

      // Check that the uploaded file contains no ANSI escape sequences
      const uploadedBuffer = uploadCalls[0].buffer;
      const uploadedContent = uploadedBuffer.toString('utf8');

      // Should not contain ANSI escape sequences
      expect(uploadedContent).to.not.match(/\x1b\[[0-9;]*m/);

      // Should contain the actual content (without ANSI codes)
      expect(uploadedContent).to.include('Passed test log line 1:');
      expect(uploadedContent).to.include('Passed test log line 2:');
      expect(uploadedContent).to.include('Passed test log line 3:');
    });
  });
});
