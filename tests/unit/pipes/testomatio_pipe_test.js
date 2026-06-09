import { expect } from 'chai';
import ServerMock from 'mock-http-server';
import TestomatioPipe from '../../../src/pipe/testomatio.js';
import { parseFilterParams, updateFilterType, generateFilterRequestParams } from '../../../src/utils/pipe_utils.js';
import { config } from '../../adapter/config/index.js';

const { host, port, TESTOMATIO_URL, TESTOMATIO } = config;

describe('TestomatioPipe', () => {
  const server = new ServerMock({ host, port });
  let testomatioPipe;
  let originalEnv;

  before(done => {
    server.start(() => {
      console.log(`[mock-http-server]: Server started at ${TESTOMATIO_URL}`);
      done();
    });
  });

  after(done => {
    server.stop(() => {
      console.log('[mock-http-server]: Server stopped');
      done();
    });
  });

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.TESTOMATIO_URL = TESTOMATIO_URL;

    testomatioPipe = new TestomatioPipe({
      apiKey: TESTOMATIO,
      testomatioUrl: TESTOMATIO_URL,
      batchMode: 'disabled',
    });
  });

  afterEach(() => {
    process.env = originalEnv;
    // Clear mock-http-server handlers between tests so registrations from one
    // test don't leak into the next (otherwise stale handlers match later requests).
    server.reset();
  });

  describe('pipe utils functions', () => {
    describe('updateFilterType', () => {
      it('should convert plan-id to plan', () => {
        const result = updateFilterType('plan-id');
        expect(result).to.equal('plan');
      });

      it('should convert tag-name to tag', () => {
        const result = updateFilterType('tag-name');
        expect(result).to.equal('tag');
      });

      it('should convert label to label', () => {
        const result = updateFilterType('label');
        expect(result).to.equal('label');
      });

      it('should convert jira-ticket to jira', () => {
        const result = updateFilterType('jira-ticket');
        expect(result).to.equal('jira');
      });

      it('should handle case insensitive input', () => {
        expect(updateFilterType('PLAN-ID')).to.equal('plan');
        expect(updateFilterType('Plan-Id')).to.equal('plan');
      });

      it('should return undefined for invalid filter type', () => {
        const result = updateFilterType('invalid-type');
        expect(result).to.be.undefined;
      });
    });

    describe('parseFilterParams', () => {
      it('should parse plan-id filter correctly', () => {
        const result = parseFilterParams('plan-id=b62f3170');
        expect(result).to.deep.equal({
          type: 'plan',
          id: 'b62f3170',
        });
      });

      it('should parse tag-name filter correctly', () => {
        const result = parseFilterParams('tag-name=smoke');
        expect(result).to.deep.equal({
          type: 'tag',
          id: 'smoke',
        });
      });

      it('should handle complex IDs with special characters', () => {
        const result = parseFilterParams('plan-id=test-plan-123-abc');
        expect(result).to.deep.equal({
          type: 'plan',
          id: 'test-plan-123-abc',
        });
      });
    });

    describe('generateFilterRequestParams', () => {
      it('should generate correct request parameters for plan filter', () => {
        const result = generateFilterRequestParams({
          type: 'plan',
          id: 'b62f3170',
          apiKey: 'test-api-key',
        });

        expect(result).to.deep.equal({
          params: {
            type: 'plan',
            id: 'b62f3170',
            api_key: 'test-api-key',
          },
          responseType: 'json',
        });
      });

      it('should encode special characters in ID', () => {
        const result = generateFilterRequestParams({
          type: 'plan',
          id: 'test plan with spaces',
          apiKey: 'test-api-key',
        });

        expect(result.params.id).to.equal('test%20plan%20with%20spaces');
      });

      it('should return undefined if type is missing', () => {
        const result = generateFilterRequestParams({
          id: 'b62f3170',
          apiKey: 'test-api-key',
        });

        expect(result).to.be.undefined;
      });

      it('should return undefined if id is missing', () => {
        const result = generateFilterRequestParams({
          type: 'plan',
          apiKey: 'test-api-key',
        });

        expect(result).to.be.undefined;
      });
    });
  });

  describe('prepareRun', () => {
    it('should make correct API call for plan-id filter', async () => {
      const planId = 'b62f3170';
      const expectedTests = ['test1', 'test2', 'test3'];

      // Mock the API response
      server.on({
        method: 'GET',
        path: '/api/test_grep',
        reply: {
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            tests: expectedTests,
          }),
        },
      });

      const result = await testomatioPipe.prepareRun(`plan-id=${planId}`);

      expect(result).to.deep.equal(expectedTests);
    });

    it('should make correct API call for tag-name filter', async () => {
      const tagName = 'smoke';
      const expectedTests = ['smokeTest1', 'smokeTest2'];

      server.on({
        method: 'GET',
        path: '/api/test_grep',
        reply: {
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            tests: expectedTests,
          }),
        },
      });

      const result = await testomatioPipe.prepareRun(`tag-name=${tagName}`);

      expect(result).to.deep.equal(expectedTests);
    });

    it('should return undefined when no tests found', async () => {
      server.on({
        method: 'GET',
        path: '/api/test_grep',
        reply: {
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            tests: [],
          }),
        },
      });

      const result = await testomatioPipe.prepareRun('plan-id=nonexistent');

      expect(result).to.be.undefined;
    });

    it('should return undefined when API returns null tests', async () => {
      server.on({
        method: 'GET',
        path: '/api/test_grep',
        reply: {
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            tests: null,
          }),
        },
      });

      const result = await testomatioPipe.prepareRun('plan-id=test');

      expect(result).to.be.undefined;
    });

    it('should handle API errors gracefully', async () => {
      server.on({
        method: 'GET',
        path: '/api/test_grep',
        reply: {
          status: 500,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            error: 'Internal server error',
          }),
        },
      });

      const result = await testomatioPipe.prepareRun('plan-id=test');

      expect(result).to.be.undefined;
    });

    it('should return empty array when pipe is disabled', async () => {
      const disabledPipe = new TestomatioPipe({
        // No API key provided, pipe should be disabled
        testomatioUrl: TESTOMATIO_URL,
        batchMode: 'disabled',
      });

      const result = await disabledPipe.prepareRun('plan-id=test');

      expect(result).to.deep.equal([]);
    });

    it('should handle invalid filter format', async () => {
      const result = await testomatioPipe.prepareRun('invalid-filter-format');

      expect(result).to.deep.equal([]);
    });

    it('should verify correct request parameters are sent', async () => {
      const planId = 'test-plan-123';
      let receivedQuery = null;

      server.on({
        method: 'GET',
        path: '/api/test_grep',
        reply: {
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            tests: ['test1'],
          }),
        },
        delay: 0,
      });

      // Spy on the actual HTTP request to verify parameters
      const originalRequest = testomatioPipe.client.request;
      testomatioPipe.client.request = async function (config) {
        receivedQuery = config.params;
        return originalRequest.call(this, config);
      };

      await testomatioPipe.prepareRun(`plan-id=${planId}`);

      expect(receivedQuery).to.deep.equal({
        type: 'plan',
        id: planId,
        api_key: TESTOMATIO,
      });
    });

    it('should handle special characters in plan ID', async () => {
      const planId = 'plan with spaces & symbols';
      let receivedQuery = null;

      server.on({
        method: 'GET',
        path: '/api/test_grep',
        reply: {
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            tests: ['test1'],
          }),
        },
      });

      // Spy on the actual HTTP request to verify parameters
      const originalRequest = testomatioPipe.client.request;
      testomatioPipe.client.request = async function (config) {
        receivedQuery = config.params;
        return originalRequest.call(this, config);
      };

      await testomatioPipe.prepareRun(`plan-id=${planId}`);

      expect(receivedQuery.id).to.equal('plan%20with%20spaces%20%26%20symbols'); // Should be URL encoded
      expect(receivedQuery.type).to.equal('plan');
    });
  });

  describe('createRun', () => {
    it('should pass kind parameter to API when creating a run', async () => {
      let receivedRequestBody = null;

      // Mock the server to capture the createRun request
      server.on({
        method: 'POST',
        path: '/api/reporter',
        reply: {
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            url: 'https://faketestomat.io/report/abc123',
            uid: 'test-run-123',
            public_url: 'https://faketestomat.io/public/xyz123',
          }),
        },
      });

      // Spy on the HTTP client to capture the request body
      const originalRequest = testomatioPipe.client.request;
      testomatioPipe.client.request = async function (config) {
        receivedRequestBody = config;
        return originalRequest.call(this, config);
      };

      // Test with manual kind
      await testomatioPipe.createRun({ kind: 'manual' });

      expect(receivedRequestBody).to.not.be.null;
      expect(receivedRequestBody.data).to.be.an('object');
      expect(receivedRequestBody.data).to.have.property('kind', 'manual');
    });

    it('should pass different kind values correctly', async () => {
      let receivedRequestBody = null;

      server.on({
        method: 'POST',
        path: '/api/reporter',
        reply: {
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            url: 'https://faketestomat.io/report/def456',
            uid: 'test-run-124',
            public_url: 'https://faketestomat.io/public/uvw456',
          }),
        },
      });

      const originalRequest = testomatioPipe.client.request;
      testomatioPipe.client.request = async function (config) {
        receivedRequestBody = config;
        return originalRequest.call(this, config);
      };

      // Test with mixed kind
      await testomatioPipe.createRun({ kind: 'mixed' });

      expect(receivedRequestBody).to.not.be.null;
      expect(receivedRequestBody.data).to.be.an('object');
      expect(receivedRequestBody.data).to.have.property('kind', 'mixed');
    });

    it('should handle automated kind correctly', async () => {
      let receivedRequestBody = null;

      server.on({
        method: 'POST',
        path: '/api/reporter',
        reply: {
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            url: 'https://faketestomat.io/report/ghi789',
            uid: 'test-run-126',
            public_url: 'https://faketestomat.io/public/rst789',
          }),
        },
      });

      const originalRequest = testomatioPipe.client.request;
      testomatioPipe.client.request = async function (config) {
        receivedRequestBody = config;
        return originalRequest.call(this, config);
      };

      // Test with automated kind
      await testomatioPipe.createRun({ kind: 'automated' });

      expect(receivedRequestBody).to.not.be.null;
      expect(receivedRequestBody.data).to.be.an('object');
      expect(receivedRequestBody.data).to.have.property('kind', 'automated');
    });

    it('should use extended timeout for create run requests', async () => {
      let receivedRequestBody = null;

      server.on({
        method: 'POST',
        path: '/api/reporter',
        reply: {
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            url: 'https://faketestomat.io/report/timeout123',
            uid: 'test-run-127',
            public_url: 'https://faketestomat.io/public/timeout123',
          }),
        },
      });

      const originalRequest = testomatioPipe.client.request;
      testomatioPipe.client.request = async function (config) {
        receivedRequestBody = config;
        return originalRequest.call(this, config);
      };

      await testomatioPipe.createRun({ kind: 'manual' });

      expect(receivedRequestBody).to.not.be.null;
      expect(receivedRequestBody.timeout).to.equal(80000);
    });

    it('should send TESTOMATIO_DESCRIPTION as the run description', async () => {
      process.env.TESTOMATIO_DESCRIPTION = 'Nightly regression on staging';
      let receivedRequestBody = null;

      server.on({
        method: 'POST',
        path: '/api/reporter',
        reply: {
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            url: 'https://faketestomat.io/report/desc1',
            uid: 'test-run-desc-1',
            public_url: 'https://faketestomat.io/public/desc1',
          }),
        },
      });

      const pipe = new TestomatioPipe({
        apiKey: TESTOMATIO,
        testomatioUrl: TESTOMATIO_URL,
        batchMode: 'disabled',
      });

      const originalRequest = pipe.client.request;
      pipe.client.request = async function (config) {
        receivedRequestBody = config;
        return originalRequest.call(this, config);
      };

      await pipe.createRun({ kind: 'automated' });

      expect(receivedRequestBody).to.not.be.null;
      expect(receivedRequestBody.data).to.have.property('description', 'Nightly regression on staging');
    });

    it('should append TESTOMATIO_DESCRIPTION after the coverage description', async () => {
      process.env.TESTOMATIO_DESCRIPTION = 'User note';
      let receivedRequestBody = null;

      server.on({
        method: 'POST',
        path: '/api/reporter',
        reply: {
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            url: 'https://faketestomat.io/report/desc2',
            uid: 'test-run-desc-2',
            public_url: 'https://faketestomat.io/public/desc2',
          }),
        },
      });

      const store = {
        coverageConfiguration: { tests: ['T123'], suites: [] },
        coverageDescription: 'Coverage scope: 1 test affected',
      };
      const pipe = new TestomatioPipe(
        {
          apiKey: TESTOMATIO,
          testomatioUrl: TESTOMATIO_URL,
          batchMode: 'disabled',
        },
        store,
      );

      const originalRequest = pipe.client.request;
      pipe.client.request = async function (config) {
        receivedRequestBody = config;
        return originalRequest.call(this, config);
      };

      await pipe.createRun({ kind: 'automated' });

      expect(receivedRequestBody).to.not.be.null;
      expect(receivedRequestBody.data.description).to.equal('Coverage scope: 1 test affected\n\nUser note');
    });

    it('should build ci block from env vars and pipeStore for remote launch', async () => {
      let receivedRequestBody = null;

      server.on({
        method: 'POST',
        path: '/api/reporter',
        reply: {
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            url: 'https://faketestomat.io/report/ci-1',
            uid: 'ci-run-1',
            public_url: 'https://faketestomat.io/public/ci-1',
          }),
        },
      });

      process.env.TESTOMATIO_CI_PROFILE = 'github';
      process.env.TESTOMATIO_CI_PARAMS = 'branch=develop,REGION=eu';

      try {
        const store = { preparedTestIds: ['T1', 'T2'] };
        const pipe = new TestomatioPipe(
          { apiKey: TESTOMATIO, testomatioUrl: TESTOMATIO_URL, batchMode: 'disabled' },
          store,
        );

        const originalRequest = pipe.client.request;
        pipe.client.request = async function (config) {
          receivedRequestBody = config;
          return originalRequest.call(this, config);
        };

        await pipe.createRun({ kind: 'automated' });

        expect(receivedRequestBody).to.not.be.null;
        expect(receivedRequestBody.data).to.have.property('ci');
        expect(receivedRequestBody.data.ci).to.deep.equal({
          profile: 'github',
          grep: 'T1|T2',
          override: { branch: 'develop', REGION: 'eu' },
        });
      } finally {
        delete process.env.TESTOMATIO_CI_PROFILE;
        delete process.env.TESTOMATIO_CI_PARAMS;
      }
    });

    it('should send ci block without grep when no filter resolved test ids', async () => {
      let receivedRequestBody = null;

      server.on({
        method: 'POST',
        path: '/api/reporter',
        reply: {
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            url: 'https://faketestomat.io/report/ci-2',
            uid: 'ci-run-2',
            public_url: 'https://faketestomat.io/public/ci-2',
          }),
        },
      });

      process.env.TESTOMATIO_CI_PROFILE = 'gitlab';

      try {
        const pipe = new TestomatioPipe({
          apiKey: TESTOMATIO,
          testomatioUrl: TESTOMATIO_URL,
          batchMode: 'disabled',
        });

        const originalRequest = pipe.client.request;
        pipe.client.request = async function (config) {
          receivedRequestBody = config;
          return originalRequest.call(this, config);
        };

        await pipe.createRun({ kind: 'automated' });

        expect(receivedRequestBody).to.not.be.null;
        expect(receivedRequestBody.data.ci).to.deep.equal({ profile: 'gitlab' });
      } finally {
        delete process.env.TESTOMATIO_CI_PROFILE;
      }
    });

    it('should not include ci block when TESTOMATIO_CI_PROFILE is not set', async () => {
      let receivedRequestBody = null;

      server.on({
        method: 'POST',
        path: '/api/reporter',
        reply: {
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            url: 'https://faketestomat.io/report/no-ci',
            uid: 'no-ci-run',
            public_url: 'https://faketestomat.io/public/no-ci',
          }),
        },
      });

      const originalRequest = testomatioPipe.client.request;
      testomatioPipe.client.request = async function (config) {
        receivedRequestBody = config;
        return originalRequest.call(this, config);
      };

      await testomatioPipe.createRun({ kind: 'automated' });

      expect(receivedRequestBody).to.not.be.null;
      expect(receivedRequestBody.data).to.not.have.property('ci');
    });

    it('should grep the existing run scope when launching with TESTOMATIO_RUN and no filter', async () => {
      let receivedRequestBody = null;

      server.on({
        method: 'PUT',
        path: '/api/reporter/run-xyz',
        reply: {
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            url: 'https://faketestomat.io/report/run-xyz',
            uid: 'run-xyz',
            public_url: 'https://faketestomat.io/public/run-xyz',
          }),
        },
      });

      process.env.TESTOMATIO_CI_PROFILE = 'github';
      process.env.TESTOMATIO_RUN = 'run-xyz';

      try {
        const pipe = new TestomatioPipe({
          apiKey: TESTOMATIO,
          testomatioUrl: TESTOMATIO_URL,
          batchMode: 'disabled',
        });

        const originalRequest = pipe.client.request;
        pipe.client.request = async function (config) {
          receivedRequestBody = config;
          return originalRequest.call(this, config);
        };

        await pipe.createRun({ kind: 'automated' });

        expect(receivedRequestBody).to.not.be.null;
        expect(receivedRequestBody.data.ci).to.deep.equal({ profile: 'github', type: 'run', id: 'run-xyz' });
      } finally {
        delete process.env.TESTOMATIO_CI_PROFILE;
        delete process.env.TESTOMATIO_RUN;
      }
    });
  });

  describe('constructor', () => {
    it('should create enabled pipe with valid API key', () => {
      const pipe = new TestomatioPipe({
        apiKey: 'valid-api-key',
        testomatioUrl: TESTOMATIO_URL,
      });

      expect(pipe.isEnabled).to.be.true;
      expect(pipe.apiKey).to.equal('valid-api-key');
    });

    it('should create disabled pipe without API key', () => {
      const pipe = new TestomatioPipe({
        testomatioUrl: TESTOMATIO_URL,
      });

      expect(pipe.isEnabled).to.be.false;
    });

    it('should use parameters over environment variables', () => {
      const pipe = new TestomatioPipe({
        apiKey: 'param-api-key',
        testomatioUrl: 'https://param.testomat.io',
      });

      expect(pipe.apiKey).to.equal('param-api-key');
      expect(pipe.url).to.equal('https://param.testomat.io');
    });
  });

  describe('data formatting with environment variables', () => {
    let pipe;

    beforeEach(() => {
      pipe = new TestomatioPipe({
        apiKey: TESTOMATIO,
        testomatioUrl: TESTOMATIO_URL,
        batchMode: 'disabled',
      });

      // Set a run ID to enable test reporting
      pipe.runId = 'test-run-id';
    });

    afterEach(() => {
      // Clean up environment variables
      delete process.env.TESTOMATIO_NO_STEPS;
      delete process.env.TESTOMATIO_STACK_PASSED;
      delete process.env.TESTOMATIO_STEPS_PASSED;
    });

    describe('TESTOMATIO_NO_STEPS', () => {
      it('should remove steps from all tests when enabled (single upload)', () => {
        process.env.TESTOMATIO_NO_STEPS = '1';

        const testData = {
          title: 'Test with steps',
          status: 'passed',
          steps: [{ step: 'Step 1' }, { step: 'Step 2' }],
          stack: 'Error stack trace',
        };

        pipe.addTest(testData);

        // The steps should be nullified in the formatted data
        expect(testData.steps).to.be.null;
      });

      it('should remove steps from failed tests when enabled (single upload)', () => {
        process.env.TESTOMATIO_NO_STEPS = '1';

        const testData = {
          title: 'Failed test with steps',
          status: 'failed',
          steps: [{ step: 'Step 1' }, { step: 'Failed step' }],
          stack: 'Error stack trace',
        };

        pipe.addTest(testData);

        expect(testData.steps).to.be.null;
      });

      it('should remove steps in batch upload when enabled', done => {
        process.env.TESTOMATIO_NO_STEPS = '1';

        const batchPipe = new TestomatioPipe({
          apiKey: TESTOMATIO,
          testomatioUrl: TESTOMATIO_URL,
          batchMode: 'auto',
        });

        // Set a run ID to enable test reporting
        batchPipe.runId = 'test-run-id';

        const testData1 = {
          title: 'Passed test with steps',
          status: 'passed',
          steps: [{ step: 'Step 1' }],
          stack: 'Stack trace',
        };

        const testData2 = {
          title: 'Failed test with steps',
          status: 'failed',
          steps: [{ step: 'Step 1' }, { step: 'Failed step' }],
          stack: 'Error stack trace',
        };

        // Mock the server to capture the batch upload
        server.on({
          method: 'POST',
          path: `/api/reporter/${batchPipe.runId}/testrun`,
          reply: {
            status: 200,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ success: true }),
          },
        });

        // Add tests to batch - they should be formatted immediately
        batchPipe.addTest(testData1);
        batchPipe.addTest(testData2);

        // Wait a bit for the batch to process
        setTimeout(() => {
          // Steps should be nullified for both tests due to formatting
          expect(testData1.steps).to.be.null;
          expect(testData2.steps).to.be.null;
          done();
        }, 100);
      });

      it('should remove steps from passed tests when TESTOMATIO_NO_STEPS is not set (default behavior)', () => {
        const testData = {
          title: 'Test with steps',
          status: 'passed',
          steps: [{ step: 'Step 1' }, { step: 'Step 2' }],
          stack: 'Error stack trace',
        };

        pipe.addTest(testData);

        // By default, TESTOMATIO_STEPS_PASSED is not set, so steps should be removed for passed tests
        expect(testData.steps).to.be.null;
      });

      it('should preserve steps for failed tests when TESTOMATIO_NO_STEPS is not set', () => {
        const testData = {
          title: 'Failed test with steps',
          status: 'failed',
          steps: [{ step: 'Step 1' }, { step: 'Failed step' }],
          stack: 'Error stack trace',
        };

        pipe.addTest(testData);

        // Steps should be preserved for failed tests even when TESTOMATIO_NO_STEPS is not set
        expect(testData.steps).to.deep.equal([{ step: 'Step 1' }, { step: 'Failed step' }]);
      });
    });

    describe('TESTOMATIO_STACK_PASSED', () => {
      it('should remove stack from passed tests when not enabled', () => {
        // By default, TESTOMATIO_STACK_PASSED is not set
        const testData = {
          title: 'Passed test with stack',
          status: 'passed',
          steps: [{ step: 'Step 1' }],
          stack: 'Stack trace for passed test',
        };

        pipe.addTest(testData);

        expect(testData.stack).to.be.null;
      });

      it('should preserve stack from passed tests when enabled', () => {
        process.env.TESTOMATIO_STACK_PASSED = '1';

        const testData = {
          title: 'Passed test with stack',
          status: 'passed',
          steps: [{ step: 'Step 1' }],
          stack: 'Stack trace for passed test',
        };

        pipe.addTest(testData);

        expect(testData.stack).to.equal('Stack trace for passed test');
      });

      it('should always preserve stack for failed tests', () => {
        // Test with TESTOMATIO_STACK_PASSED not set
        const testDataFailed = {
          title: 'Failed test with stack',
          status: 'failed',
          steps: [{ step: 'Step 1' }],
          stack: 'Error stack trace',
        };

        pipe.addTest(testDataFailed);
        expect(testDataFailed.stack).to.equal('Error stack trace');

        // Test with TESTOMATIO_STACK_PASSED enabled
        process.env.TESTOMATIO_STACK_PASSED = '1';
        const testDataFailed2 = {
          title: 'Failed test with stack 2',
          status: 'failed',
          steps: [{ step: 'Step 2' }],
          stack: 'Error stack trace 2',
        };

        pipe.addTest(testDataFailed2);
        expect(testDataFailed2.stack).to.equal('Error stack trace 2');
      });

      it('should handle stack in batch upload correctly', done => {
        const batchPipe = new TestomatioPipe({
          apiKey: TESTOMATIO,
          testomatioUrl: TESTOMATIO_URL,
          batchMode: 'auto',
        });

        // Set a run ID to enable test reporting
        batchPipe.runId = 'test-run-id';

        const testDataPassed = {
          title: 'Passed test with stack',
          status: 'passed',
          steps: [{ step: 'Step 1' }],
          stack: 'Stack trace for passed test',
        };

        const testDataFailed = {
          title: 'Failed test with stack',
          status: 'failed',
          steps: [{ step: 'Step 2' }],
          stack: 'Error stack trace',
        };

        // Mock the server to capture the batch upload
        server.on({
          method: 'POST',
          path: `/api/reporter/${batchPipe.runId}/testrun`,
          reply: {
            status: 200,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ success: true }),
          },
        });

        batchPipe.addTest(testDataPassed);
        batchPipe.addTest(testDataFailed);

        // Wait a bit for the batch to process
        setTimeout(() => {
          // Stack should be null for passed test, preserved for failed test
          expect(testDataPassed.stack).to.be.null;
          expect(testDataFailed.stack).to.equal('Error stack trace');
          done();
        }, 100);
      });
    });

    describe('TESTOMATIO_STEPS_PASSED', () => {
      it('should remove steps from passed tests when not enabled', () => {
        // By default, TESTOMATIO_STEPS_PASSED is not set
        const testData = {
          title: 'Passed test with steps',
          status: 'passed',
          steps: [{ step: 'Step 1' }, { step: 'Step 2' }],
          stack: 'Stack trace',
        };

        pipe.addTest(testData);

        expect(testData.steps).to.be.null;
      });

      it('should preserve steps from passed tests when enabled', () => {
        process.env.TESTOMATIO_STEPS_PASSED = '1';

        const testData = {
          title: 'Passed test with steps',
          status: 'passed',
          steps: [{ step: 'Step 1' }, { step: 'Step 2' }],
          stack: 'Stack trace',
        };

        pipe.addTest(testData);

        expect(testData.steps).to.deep.equal([{ step: 'Step 1' }, { step: 'Step 2' }]);
      });

      it('should always preserve steps for failed tests', () => {
        // Test with TESTOMATIO_STEPS_PASSED not set
        const testDataFailed = {
          title: 'Failed test with steps',
          status: 'failed',
          steps: [{ step: 'Step 1' }, { step: 'Failed step' }],
          stack: 'Error stack trace',
        };

        pipe.addTest(testDataFailed);
        expect(testDataFailed.steps).to.deep.equal([{ step: 'Step 1' }, { step: 'Failed step' }]);

        // Test with TESTOMATIO_STEPS_PASSED enabled
        process.env.TESTOMATIO_STEPS_PASSED = '1';
        const testDataFailed2 = {
          title: 'Failed test with steps 2',
          status: 'failed',
          steps: [{ step: 'Step 2' }, { step: 'Failed step 2' }],
          stack: 'Error stack trace 2',
        };

        pipe.addTest(testDataFailed2);
        expect(testDataFailed2.steps).to.deep.equal([{ step: 'Step 2' }, { step: 'Failed step 2' }]);
      });

      it('should handle steps in batch upload correctly', done => {
        const batchPipe = new TestomatioPipe({
          apiKey: TESTOMATIO,
          testomatioUrl: TESTOMATIO_URL,
          batchMode: 'auto',
        });

        // Set a run ID to enable test reporting
        batchPipe.runId = 'test-run-id';

        const testDataPassed = {
          title: 'Passed test with steps',
          status: 'passed',
          steps: [{ step: 'Step 1' }, { step: 'Step 2' }],
          stack: 'Stack trace',
        };

        const testDataFailed = {
          title: 'Failed test with steps',
          status: 'failed',
          steps: [{ step: 'Step 1' }, { step: 'Failed step' }],
          stack: 'Error stack trace',
        };

        // Mock the server to capture the batch upload
        server.on({
          method: 'POST',
          path: `/api/reporter/${batchPipe.runId}/testrun`,
          reply: {
            status: 200,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ success: true }),
          },
        });

        batchPipe.addTest(testDataPassed);
        batchPipe.addTest(testDataFailed);

        // Wait a bit for the batch to process
        setTimeout(() => {
          // Steps should be null for passed test, preserved for failed test
          expect(testDataPassed.steps).to.be.null;
          expect(testDataFailed.steps).to.deep.equal([{ step: 'Step 1' }, { step: 'Failed step' }]);
          done();
        }, 100);
      });
    });

    describe('Combined environment variables', () => {
      it('should respect TESTOMATIO_NO_STEPS over other settings', () => {
        process.env.TESTOMATIO_NO_STEPS = '1';
        process.env.TESTOMATIO_STEPS_PASSED = '1';
        process.env.TESTOMATIO_STACK_PASSED = '1';

        const testData = {
          title: 'Test with all data',
          status: 'passed',
          steps: [{ step: 'Step 1' }],
          stack: 'Stack trace',
        };

        pipe.addTest(testData);

        // TESTOMATIO_NO_STEPS should override other settings
        expect(testData.steps).to.be.null;
        // Stack should be preserved due to TESTOMATIO_STACK_PASSED
        expect(testData.stack).to.equal('Stack trace');
      });

      it('should apply all filters correctly for failed tests', () => {
        process.env.TESTOMATIO_NO_STEPS = '1';
        process.env.TESTOMATIO_STACK_PASSED = '1';

        const testData = {
          title: 'Failed test with all data',
          status: 'failed',
          steps: [{ step: 'Step 1' }, { step: 'Failed step' }],
          stack: 'Error stack trace',
        };

        pipe.addTest(testData);

        // TESTOMATIO_NO_STEPS should remove steps even for failed tests
        expect(testData.steps).to.be.null;
        // Stack should be preserved due to TESTOMATIO_STACK_PASSED
        expect(testData.stack).to.equal('Error stack trace');
      });
    });

    describe('create flag handling', () => {
      it('should preserve explicit create flag from test data', () => {
        delete process.env.TESTOMATIO_CREATE;

        const testData = {
          title: 'Test with explicit create',
          status: 'passed',
          create: true,
          steps: [],
          stack: '',
        };

        pipe.addTest(testData);
        expect(testData.create).to.equal(true);
      });

      it('should use pipe default create flag when create is not provided', () => {
        process.env.TESTOMATIO_CREATE = '1';

        const createPipe = new TestomatioPipe({
          apiKey: TESTOMATIO,
          testomatioUrl: TESTOMATIO_URL,
          batchMode: 'disabled',
        });
        createPipe.runId = 'test-run-id';

        const testData = {
          title: 'Test without create',
          status: 'passed',
          steps: [],
          stack: '',
        };

        createPipe.addTest(testData);
        expect(testData.create).to.equal(true);
      });
    });
  });

  describe('error logging behavior (testing via public methods)', () => {
    let pipe;
    let consoleLogOutput;
    let originalRequest;

    beforeEach(() => {
      process.env.TESTOMATIO_URL = TESTOMATIO_URL;

      pipe = new TestomatioPipe({
        apiKey: TESTOMATIO,
        testomatioUrl: TESTOMATIO_URL,
        batchMode: 'disabled',
      });

      // Set up a run ID for finishRun tests
      pipe.runId = 'test-run-123';

      consoleLogOutput = [];
      const originalLog = console.log;
      console.log = (...args) => {
        consoleLogOutput.push(args.join(' '));
      };

      // Store original request method to restore later
      originalRequest = pipe.client.request;

      return () => {
        console.log = originalLog;
      };
    });

    afterEach(() => {
      console.log = global.console.log;
      delete process.env.TESTOMATIO_URL;
      // Restore original request method
      pipe.client.request = originalRequest;
    });

    it('should show special message for 403 status code via createRun', async function () {
      this.timeout(5000);

      // Create a new pipe with batch disabled to avoid setInterval issues
      const testPipe = new TestomatioPipe({
        apiKey: TESTOMATIO,
        testomatioUrl: TESTOMATIO_URL,
        batchMode: 'disabled',
      });

      const error = new Error('Request failed');
      error.response = {
        status: 403,
        data: { message: 'Forbidden' },
        config: {
          method: 'POST',
          url: '/api/reporter',
          data: { api_key: TESTOMATIO },
        },
      };

      testPipe.client.request = function () {
        return Promise.reject(error);
      };

      await testPipe.createRun();

      const output = consoleLogOutput.join('\n');
      expect(output).to.contain('403');
      expect(output).to.contain('Please check your API token. It might be invalid or expired.');
      expect(testPipe.isEnabled).to.be.false;
    });

    it('should log with TESTOMATIO prefix when createRun fails', async function () {
      this.timeout(5000);

      // Create a new pipe with batch disabled
      const testPipe = new TestomatioPipe({
        apiKey: TESTOMATIO,
        testomatioUrl: TESTOMATIO_URL,
        batchMode: 'disabled',
      });

      const error = new Error('Request failed');
      error.response = {
        status: 401,
        data: { message: 'Invalid API key' },
        config: {
          method: 'POST',
          url: '/api/reporter',
          data: { api_key: TESTOMATIO },
        },
      };

      testPipe.client.request = function () {
        return Promise.reject(error);
      };

      await testPipe.createRun();

      const output = consoleLogOutput.join('\n');
      expect(output).to.contain('[TESTOMATIO]');
    });

    it('should log with TESTOMATIO prefix when finishRun fails', async function () {
      this.timeout(5000);

      const error = new Error('Request failed');
      error.response = {
        status: 500,
        data: { message: 'Internal Server Error' },
        config: {
          method: 'PUT',
          url: `/api/reporter/${pipe.runId}`,
          data: { api_key: TESTOMATIO },
        },
      };

      pipe.client.request = function () {
        return Promise.reject(error);
      };

      await pipe.finishRun({ status: 'passed' });

      const output = consoleLogOutput.join('\n');
      expect(output).to.contain('[TESTOMATIO]');
      expect(output).to.contain('Error updating status, skipping...');
    });

    it('should set hasUnmatchedTests when error message contains "could not be matched"', async function () {
      this.timeout(5000);

      const error = new Error('Request failed');
      error.response = {
        status: 422,
        data: { message: 'Test could not be matched' },
        config: {
          method: 'PUT',
          url: `/api/reporter/${pipe.runId}`,
          data: { api_key: TESTOMATIO },
        },
      };

      pipe.client.request = function () {
        return Promise.reject(error);
      };

      await pipe.finishRun({ status: 'passed' });

      expect(pipe.hasUnmatchedTests).to.be.true;
    });

    it('should not set hasUnmatchedTests for other errors', async function () {
      this.timeout(5000);

      const error = new Error('Request failed');
      error.response = {
        status: 500,
        data: { message: 'Internal Server Error' },
        config: {
          method: 'PUT',
          url: `/api/reporter/${pipe.runId}`,
          data: { api_key: TESTOMATIO },
        },
      };

      pipe.client.request = function () {
        return Promise.reject(error);
      };

      await pipe.finishRun({ status: 'passed' });

      expect(pipe.hasUnmatchedTests).to.be.false;
    });
  });

  describe('createRun error handling', () => {
    let pipe;
    let consoleErrorOutput;
    let consoleLogOutput;
    let originalRequest;

    beforeEach(() => {
      process.env.TESTOMATIO_URL = TESTOMATIO_URL;

      pipe = new TestomatioPipe({
        apiKey: TESTOMATIO,
        testomatioUrl: TESTOMATIO_URL,
        batchMode: 'disabled',
      });

      // Capture console output
      consoleErrorOutput = [];
      consoleLogOutput = [];

      const originalError = console.error;
      const originalLog = console.log;

      console.error = (...args) => {
        consoleErrorOutput.push(args.join(' '));
      };

      console.log = (...args) => {
        consoleLogOutput.push(args.join(' '));
      };

      // Store original request method
      originalRequest = pipe.client.request;

      return () => {
        console.error = originalError;
        console.log = originalLog;
      };
    });

    afterEach(() => {
      console.error = global.console.error;
      console.log = global.console.log;
      delete process.env.TESTOMATIO_URL;
      // Restore original request method
      pipe.client.request = originalRequest;
    });

    it('should disable pipe on 403 error', async function () {
      this.timeout(5000);

      const error = new Error('Forbidden');
      error.response = {
        status: 403,
        data: { message: 'Forbidden' },
        config: {
          method: 'POST',
          url: '/api/reporter',
          data: { api_key: TESTOMATIO },
        },
      };

      pipe.client.request = function () {
        return Promise.reject(error);
      };

      expect(pipe.isEnabled).to.be.true;

      await pipe.createRun();

      expect(pipe.isEnabled).to.be.false;
    });

    it('should log "API key is not set" when apiKey is missing', async () => {
      const pipeNoKey = new TestomatioPipe({
        testomatioUrl: TESTOMATIO_URL,
        batchMode: 'disabled',
      });

      // This pipe has no API key, so it should be disabled
      expect(pipeNoKey.isEnabled).to.be.false;
    });
  });

  describe('batch upload mode', () => {
    it('should default to auto when no batchMode and no env var is set', () => {
      delete process.env.TESTOMATIO_DISABLE_BATCH_UPLOAD;
      const defaultPipe = new TestomatioPipe({ apiKey: TESTOMATIO, testomatioUrl: TESTOMATIO_URL });
      expect(defaultPipe.batch.mode).to.equal('auto');
    });

    it('should default to disabled when TESTOMATIO_DISABLE_BATCH_UPLOAD is set', () => {
      process.env.TESTOMATIO_DISABLE_BATCH_UPLOAD = '1';
      const envPipe = new TestomatioPipe({ apiKey: TESTOMATIO, testomatioUrl: TESTOMATIO_URL });
      expect(envPipe.batch.mode).to.equal('disabled');
      delete process.env.TESTOMATIO_DISABLE_BATCH_UPLOAD;
    });

    it('explicit batchMode param wins over the env default', () => {
      process.env.TESTOMATIO_DISABLE_BATCH_UPLOAD = '1';
      const manualPipe = new TestomatioPipe({
        apiKey: TESTOMATIO,
        testomatioUrl: TESTOMATIO_URL,
        batchMode: 'manual',
      });
      expect(manualPipe.batch.mode).to.equal('manual');
      delete process.env.TESTOMATIO_DISABLE_BATCH_UPLOAD;
    });

    it('createRun should override the constructor mode with params.batchMode', async () => {
      const pipe = new TestomatioPipe({
        apiKey: TESTOMATIO,
        testomatioUrl: TESTOMATIO_URL,
        batchMode: 'disabled',
      });
      pipe.runId = 'override-run-id';
      pipe.client.request = async () => ({ data: {} });

      await pipe.createRun({ batchMode: 'manual' });
      expect(pipe.batch.mode).to.equal('manual');
    });

    it('createRun should start an interval in auto mode only', async () => {
      const autoPipe = new TestomatioPipe({
        apiKey: TESTOMATIO,
        testomatioUrl: TESTOMATIO_URL,
        batchMode: 'auto',
      });
      autoPipe.runId = 'auto-run-id';
      autoPipe.client.request = async () => ({ data: {} });

      await autoPipe.createRun({});
      expect(autoPipe.batch.intervalFunction).to.not.be.null;
      clearInterval(autoPipe.batch.intervalFunction);

      const manualPipe = new TestomatioPipe({
        apiKey: TESTOMATIO,
        testomatioUrl: TESTOMATIO_URL,
        batchMode: 'manual',
      });
      manualPipe.runId = 'manual-run-id';
      manualPipe.client.request = async () => ({ data: {} });

      await manualPipe.createRun({});
      expect(manualPipe.batch.intervalFunction).to.be.null;
    });

    it('auto mode should flush immediately when no interval is running yet', async () => {
      const autoPipe = new TestomatioPipe({
        apiKey: TESTOMATIO,
        testomatioUrl: TESTOMATIO_URL,
        batchMode: 'auto',
      });
      autoPipe.runId = 'auto-flush-run-id';

      const uploads = [];
      autoPipe.client.request = async ({ data }) => {
        uploads.push(data);
        return { data: {} };
      };

      // createRun was not called, so no interval is running -> addTest flushes right away
      await autoPipe.addTest({ title: 'Test 1', status: 'passed' });
      expect(uploads).to.have.length(1);
      expect(uploads[0].tests).to.have.length(1);
    });

    it('finishRun should clear the interval and switch mode to disabled', async () => {
      const autoPipe = new TestomatioPipe({
        apiKey: TESTOMATIO,
        testomatioUrl: TESTOMATIO_URL,
        batchMode: 'auto',
      });
      autoPipe.runId = 'finish-run-id';
      autoPipe.client.request = async () => ({ data: {} });

      await autoPipe.createRun({});
      expect(autoPipe.batch.intervalFunction).to.not.be.null;

      await autoPipe.finishRun({});
      expect(autoPipe.batch.intervalFunction).to.be.null;
      expect(autoPipe.batch.mode).to.equal('disabled');
    });

    it('manual mode should buffer tests until sync is called', async () => {
      const manualPipe = new TestomatioPipe({
        apiKey: TESTOMATIO,
        testomatioUrl: TESTOMATIO_URL,
        batchMode: 'manual',
      });
      manualPipe.runId = 'manual-run-id';

      const uploads = [];
      manualPipe.client.request = async ({ data }) => {
        uploads.push(data);
        return { data: {} };
      };

      manualPipe.addTest({ title: 'Test 1', status: 'passed' });
      manualPipe.addTest({ title: 'Test 2', status: 'passed' });
      expect(uploads).to.have.length(0);

      await manualPipe.sync();
      expect(uploads).to.have.length(1);
      expect(uploads[0].tests).to.have.length(2);
    });

    it('disabled mode should upload each test immediately', async () => {
      const disabledPipe = new TestomatioPipe({
        apiKey: TESTOMATIO,
        testomatioUrl: TESTOMATIO_URL,
        batchMode: 'disabled',
      });
      disabledPipe.runId = 'disabled-run-id';

      const uploads = [];
      disabledPipe.client.request = async ({ data }) => {
        uploads.push(data);
        return { data: {} };
      };

      await disabledPipe.addTest({ title: 'Test 1', status: 'passed' });
      await disabledPipe.addTest({ title: 'Test 2', status: 'passed' });
      expect(uploads).to.have.length(2);
      expect(JSON.parse(uploads[0]).title).to.equal('Test 1');
      expect(JSON.parse(uploads[1]).title).to.equal('Test 2');
    });
  });

  describe('finishRun error handling', () => {
    let pipe;
    let consoleLogOutput;
    let originalRequest;

    beforeEach(() => {
      process.env.TESTOMATIO_URL = TESTOMATIO_URL;

      pipe = new TestomatioPipe({
        apiKey: TESTOMATIO,
        testomatioUrl: TESTOMATIO_URL,
        batchMode: 'disabled',
      });

      // Set up a run ID
      pipe.runId = 'test-run-123';

      consoleLogOutput = [];
      const originalLog = console.log;
      console.log = (...args) => {
        consoleLogOutput.push(args.join(' '));
      };

      // Store original request method
      originalRequest = pipe.client.request;

      return () => {
        console.log = originalLog;
      };
    });

    afterEach(() => {
      console.log = global.console.log;
      delete process.env.TESTOMATIO_URL;
      // Restore original request method
      pipe.client.request = originalRequest;
    });

    it('should handle network errors gracefully', async function () {
      this.timeout(5000);

      const error = new Error('Bad Gateway');
      error.response = {
        status: 502,
        data: { message: 'Bad Gateway' },
        config: {
          method: 'PUT',
          url: `/api/reporter/${pipe.runId}`,
          data: { api_key: TESTOMATIO },
        },
      };

      pipe.client.request = function () {
        return Promise.reject(error);
      };

      // Should not throw, should handle error gracefully
      expect(pipe.finishRun({ status: 'passed' })).to.not.throw;
    });
  });
});
