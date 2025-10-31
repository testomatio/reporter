import { expect } from 'chai';
import TestomatioClient from '../../src/client.js';

describe('Client Stack Artifacts', () => {
  let client;
  let originalUploadFileAsBuffer;
  let uploadCalls;

  beforeEach(() => {
    client = new TestomatioClient();
    client.runId = 'test-run-123';
    uploadCalls = [];

    // Mock the uploader to avoid actual S3 calls
    originalUploadFileAsBuffer = client.uploader.uploadFileAsBuffer;
    client.uploader.uploadFileAsBuffer = async (buffer, path) => {
      uploadCalls.push({ buffer, path });
      return 'https://test-bucket.s3.amazonaws.com/artifact';
    };
  });

  afterEach(() => {
    // Restore original method
    client.uploader.uploadFileAsBuffer = originalUploadFileAsBuffer;
    delete process.env.TESTOMATIO_STACK_ARTIFACTS;
  });

  describe('addTestRun method', () => {
    beforeEach(() => {
      // Mock pipes to avoid actual API calls
      client.pipes = [];
    });

    describe('when TESTOMATIO_STACK_ARTIFACTS is disabled', () => {
      it('should not save stack as artifact for normal sized stack', async () => {
        const testData = {
          title: 'Test Title',
          suite_title: 'Test Suite',
          error: new Error('Test error'),
          steps: [{ title: 'Step 1', duration: 100 }],
          logs: 'Test log message',
          rid: 'test-123'
        };

        await client.addTestRun('failed', testData);

        expect(uploadCalls).to.have.length(0);
      });

      it('should not save stack as artifact for large stack when feature is disabled', async () => {
        const largeStack = 'Error: Large error\n' + '    at Context.<anonymous> (test.js:10:5)\n'.repeat(300);
        const error = new Error('Large error');
        error.stack = largeStack;

        const testData = {
          title: 'Test Title',
          suite_title: 'Test Suite',
          error,
          steps: [],
          logs: ''
        };

        await client.addTestRun('failed', testData);

        expect(uploadCalls).to.have.length(0);
      });
    });

    describe('when TESTOMATIO_STACK_ARTIFACTS is enabled', () => {
      beforeEach(() => {
        process.env.TESTOMATIO_STACK_ARTIFACTS = '1';
      });

      it('should not save small stack as artifact', async () => {
        const error = new Error('Small error');
        const testData = {
          title: 'Test Title',
          suite_title: 'Test Suite',
          error,
          steps: [],
          logs: ''
        };

        await client.addTestRun('failed', testData);

        expect(uploadCalls).to.have.length(0);
      });

      it('should save large stack as artifact when it exceeds 5000 characters', async () => {
        const largeStack = 'Error: Large error\n' + '    at Context.<anonymous> (test.js:10:5)\n'.repeat(300);
        const error = new Error('Large error');
        error.stack = largeStack;

        const testData = {
          title: 'Test Title',
          suite_title: 'Test Suite',
          error,
          steps: [],
          logs: '',
          rid: 'test-123'
        };

        await client.addTestRun('failed', testData);

        expect(uploadCalls).to.have.length(1);
        expect(uploadCalls[0].buffer).to.be.instanceOf(Buffer);
        expect(uploadCalls[0].path[0]).to.equal('test-run-123');
        expect(uploadCalls[0].path[1]).to.be.a('string'); // test id (could be empty)
        expect(uploadCalls[0].path[2]).to.match(/^stack_\d+\.log$/);

        // Verify the buffer contains the large stack
        const stackContent = uploadCalls[0].buffer.toString('utf8');
        expect(stackContent).to.include('Error: Large error');
      });

      it('should save large steps as artifact when it exceeds 10000 characters', async () => {
        const largeSteps = Array(200).fill().map((_, i) => ({
          title: `This is a very long step title that takes up a lot of characters ${i}`,
          duration: 100
        }));

        const testData = {
          title: 'Test Title',
          suite_title: 'Test Suite',
          steps: largeSteps,
          logs: '',
          rid: 'test-123'
        };

        await client.addTestRun('passed', testData);

        expect(uploadCalls).to.have.length(1);
        expect(uploadCalls[0].buffer).to.be.instanceOf(Buffer);
        expect(uploadCalls[0].path[0]).to.equal('test-run-123');
        expect(uploadCalls[0].path[1]).to.be.a('string'); // test id (could be empty)
        expect(uploadCalls[0].path[2]).to.match(/^steps_\d+\.json$/);

        // Verify the buffer contains the steps as JSON
        const stepsContent = uploadCalls[0].buffer.toString('utf8');
        const parsedSteps = JSON.parse(stepsContent);
        expect(parsedSteps).to.deep.equal(largeSteps);
      });

      it('should save both stack and steps as artifacts when both are large', async () => {
        const largeStack = 'Error: Large error\n' + '    at Context.<anonymous> (test.js:10:5)\n'.repeat(300);
        const error = new Error('Large error');
        error.stack = largeStack;

        const largeSteps = Array(200).fill().map((_, i) => ({
          title: `This is a very long step title that takes up a lot of characters ${i}`,
          duration: 100
        }));

        const testData = {
          title: 'Test Title',
          suite_title: 'Test Suite',
          error,
          steps: largeSteps,
          logs: ''
        };

        await client.addTestRun('failed', testData);

        expect(uploadCalls).to.have.length(2);

        // Check stack artifact
        const stackCall = uploadCalls.find(call => call.path[2].startsWith('stack_'));
        expect(stackCall).to.exist;
        expect(stackCall.path[2]).to.match(/^stack_\d+\.log$/);

        // Check steps artifact
        const stepsCall = uploadCalls.find(call => call.path[2].startsWith('steps_'));
        expect(stepsCall).to.exist;
        expect(stepsCall.path[2]).to.match(/^steps_\d+\.json$/);
      });

      it('should handle truthy variations of TESTOMATIO_STACK_ARTIFACTS', async () => {
        process.env.TESTOMATIO_STACK_ARTIFACTS = 'true';

        const largeStack = 'Error: Large error\n' + '    at Context.<anonymous> (test.js:10:5)\n'.repeat(300);
        const error = new Error('Large error');
        error.stack = largeStack;

        const testData = {
          title: 'Test Title',
          suite_title: 'Test Suite',
          error,
          steps: [],
          logs: ''
        };

        await client.addTestRun('failed', testData);

        expect(uploadCalls).to.have.length(1);
      });

      it('should handle falsy variations of TESTOMATIO_STACK_ARTIFACTS', async () => {
        process.env.TESTOMATIO_STACK_ARTIFACTS = 'false';

        const largeStack = 'Error: Large error\n' + '    at Context.<anonymous> (test.js:10:5)\n'.repeat(300);
        const error = new Error('Large error');
        error.stack = largeStack;

        const testData = {
          title: 'Test Title',
          suite_title: 'Test Suite',
          error,
          steps: [],
          logs: ''
        };

        await client.addTestRun('failed', testData);

        expect(uploadCalls).to.have.length(0);
      });

      it('should preserve timestamp format in artifact names', async () => {
        const largeStack = 'Error: Large error\n' + '    at Context.<anonymous> (test.js:10:5)\n'.repeat(300);
        const error = new Error('Large error');
        error.stack = largeStack;

        const testData = {
          title: 'Test Title',
          suite_title: 'Test Suite',
          error,
          steps: [],
          logs: ''
        };

        await client.addTestRun('failed', testData);

        const filename = uploadCalls[0].path[2];
        expect(filename).to.match(/^stack_\d+\.log$/);

        // Verify timestamp is numeric
        const timestamp = filename.match(/^stack_(\d+)\.log$/)[1];
        expect(parseInt(timestamp)).to.be.a('number');
      });

      it('should save steps as JSON with proper formatting', async () => {
        const largeSteps = Array(300).fill().map((_, i) => ({
          title: `This is a very long step title that takes up a lot of characters and ensures the data is large enough to trigger artifact saving ${i}`,
          duration: 100,
          category: 'test',
          description: `This is also a long description for step ${i} to make sure we exceed the character limit for artifact creation`
        }));

        const testData = {
          title: 'Test Title',
          suite_title: 'Test Suite',
          steps: largeSteps,
          logs: ''
        };

        await client.addTestRun('passed', testData);

        expect(uploadCalls).to.have.length(1);
        const uploadedBuffer = uploadCalls[0].buffer;
        const jsonContent = uploadedBuffer.toString('utf8');
        const parsedSteps = JSON.parse(jsonContent);

        expect(parsedSteps).to.deep.equal(largeSteps);
        expect(jsonContent).to.include('  "title"'); // Check for proper indentation
      });
    });
  });
});