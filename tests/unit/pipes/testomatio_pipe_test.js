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
      isBatchEnabled: false
    });
  });

  afterEach(() => {
    process.env = originalEnv;
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
          id: 'b62f3170'
        });
      });

      it('should parse tag-name filter correctly', () => {
        const result = parseFilterParams('tag-name=smoke');
        expect(result).to.deep.equal({
          type: 'tag',
          id: 'smoke'
        });
      });

      it('should handle complex IDs with special characters', () => {
        const result = parseFilterParams('plan-id=test-plan-123-abc');
        expect(result).to.deep.equal({
          type: 'plan',
          id: 'test-plan-123-abc'
        });
      });
    });

    describe('generateFilterRequestParams', () => {
      it('should generate correct request parameters for plan filter', () => {
        const result = generateFilterRequestParams({
          type: 'plan',
          id: 'b62f3170',
          apiKey: 'test-api-key'
        });

        expect(result).to.deep.equal({
          params: {
            type: 'plan',
            id: 'b62f3170',
            api_key: 'test-api-key'
          },
          responseType: 'json'
        });
      });

      it('should encode special characters in ID', () => {
        const result = generateFilterRequestParams({
          type: 'plan',
          id: 'test plan with spaces',
          apiKey: 'test-api-key'
        });

        expect(result.params.id).to.equal('test%20plan%20with%20spaces');
      });

      it('should return undefined if type is missing', () => {
        const result = generateFilterRequestParams({
          id: 'b62f3170',
          apiKey: 'test-api-key'
        });

        expect(result).to.be.undefined;
      });

      it('should return undefined if id is missing', () => {
        const result = generateFilterRequestParams({
          type: 'plan',
          apiKey: 'test-api-key'
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
            tests: expectedTests
          })
        }
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
            tests: expectedTests
          })
        }
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
            tests: []
          })
        }
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
            tests: null
          })
        }
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
            error: 'Internal server error'
          })
        }
      });

      const result = await testomatioPipe.prepareRun('plan-id=test');

      expect(result).to.be.undefined;
    });

    it('should return empty array when pipe is disabled', async () => {
      const disabledPipe = new TestomatioPipe({
        // No API key provided, pipe should be disabled
        testomatioUrl: TESTOMATIO_URL,
        isBatchEnabled: false
      });

      const result = await disabledPipe.prepareRun('plan-id=test');

      expect(result).to.deep.equal([]);
    });

    it('should handle invalid filter format', async () => {
      const result = await testomatioPipe.prepareRun('invalid-filter-format');

      expect(result).to.be.undefined;
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
            tests: ['test1']
          })
        },
        delay: 0
      });

      // Spy on the actual HTTP request to verify parameters
      const originalRequest = testomatioPipe.client.request;
      testomatioPipe.client.request = async function(config) {
        receivedQuery = config.params;
        return originalRequest.call(this, config);
      };

      await testomatioPipe.prepareRun(`plan-id=${planId}`);

      expect(receivedQuery).to.deep.equal({
        type: 'plan',
        id: planId,
        api_key: TESTOMATIO
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
            tests: ['test1']
          })
        }
      });

      // Spy on the actual HTTP request to verify parameters
      const originalRequest = testomatioPipe.client.request;
      testomatioPipe.client.request = async function(config) {
        receivedQuery = config.params;
        return originalRequest.call(this, config);
      };

      await testomatioPipe.prepareRun(`plan-id=${planId}`);

      expect(receivedQuery.id).to.equal('plan%20with%20spaces%20%26%20symbols'); // Should be URL encoded
      expect(receivedQuery.type).to.equal('plan');
    });
  });

  describe('constructor', () => {
    it('should create enabled pipe with valid API key', () => {
      const pipe = new TestomatioPipe({
        apiKey: 'valid-api-key',
        testomatioUrl: TESTOMATIO_URL
      });

      expect(pipe.isEnabled).to.be.true;
      expect(pipe.apiKey).to.equal('valid-api-key');
    });

    it('should create disabled pipe without API key', () => {
      const pipe = new TestomatioPipe({
        testomatioUrl: TESTOMATIO_URL
      });

      expect(pipe.isEnabled).to.be.false;
    });

    it('should use parameters over environment variables', () => {
      const pipe = new TestomatioPipe({
        apiKey: 'param-api-key',
        testomatioUrl: 'https://param.testomat.io'
      });

      expect(pipe.apiKey).to.equal('param-api-key');
      expect(pipe.url).to.equal('https://param.testomat.io');
    });
  });
});