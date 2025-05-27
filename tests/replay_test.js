import { expect } from 'chai';
import fs from 'fs';
import path from 'path';
import os from 'os';
import ReplayService from '../src/replay.js';
import TestomatClient from '../src/client.js';
import { STATUS } from '../src/constants.js';

describe('ReplayService', () => {
  let tempDir;
  let debugFile;
  let replayService;
  let originalEnv;
  let mockLogs = [];
  let mockErrors = [];
  let mockProgress = [];

  // Mock functions
  const mockOnLog = (message) => mockLogs.push(message);
  const mockOnError = (message) => mockErrors.push(message);
  const mockOnProgress = (data) => mockProgress.push(data);

  beforeEach(() => {
    originalEnv = { ...process.env };
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'replay-test-'));
    debugFile = path.join(tempDir, 'test-debug.json');
    
    // Reset mock arrays
    mockLogs = [];
    mockErrors = [];
    mockProgress = [];
    
    replayService = new ReplayService({
      apiKey: 'test-api-key',
      onLog: mockOnLog,
      onError: mockOnError,
      onProgress: mockOnProgress
    });
  });

  afterEach(() => {
    process.env = originalEnv;
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const service = new ReplayService();
      expect(service.apiKey).to.be.undefined;
      expect(service.dryRun).to.be.false;
      expect(service.onProgress).to.be.a('function');
      expect(service.onLog).to.be.a('function');
      expect(service.onError).to.be.a('function');
    });

    it('should initialize with custom options', () => {
      const customOnLog = () => {};
      const customOnError = () => {};
      const customOnProgress = () => {};
      
      const service = new ReplayService({
        apiKey: 'custom-key',
        dryRun: true,
        onLog: customOnLog,
        onError: customOnError,
        onProgress: customOnProgress
      });

      expect(service.apiKey).to.equal('custom-key');
      expect(service.dryRun).to.be.true;
      expect(service.onLog).to.equal(customOnLog);
      expect(service.onError).to.equal(customOnError);
      expect(service.onProgress).to.equal(customOnProgress);
    });
  });

  describe('getDefaultDebugFile', () => {
    it('should return the correct default debug file path', () => {
      const expected = path.join(os.tmpdir(), 'testomatio.debug.latest.json');
      expect(replayService.getDefaultDebugFile()).to.equal(expected);
    });
  });

  describe('parseDebugFile', () => {
    it('should throw error if file does not exist', () => {
      const nonExistentFile = path.join(tempDir, 'non-existent.json');
      expect(() => replayService.parseDebugFile(nonExistentFile))
        .to.throw('Debug file not found');
    });

    it('should throw error if file is empty', () => {
      fs.writeFileSync(debugFile, '');
      expect(() => replayService.parseDebugFile(debugFile))
        .to.throw('Debug file is empty');
    });

    it('should parse valid debug file with all data types', () => {
      const debugData = [
        { data: 'variables', testomatioEnvVars: { TESTOMATIO: 'test-key', TESTOMATIO_TITLE: 'Test Run' } },
        { action: 'createRun', params: { title: 'Test Run', parallel: true } },
        { action: 'addTestsBatch', tests: [
          { id: 'test1', status: 'passed', title: 'Test 1' },
          { id: 'test2', status: 'failed', title: 'Test 2' }
        ]},
        { action: 'addTest', testId: { id: 'test3', status: 'passed', title: 'Test 3' } },
        { actions: 'finishRun', params: { status: 'finished', parallel: true } }
      ];

      const fileContent = debugData.map(line => JSON.stringify(line)).join('\n');
      fs.writeFileSync(debugFile, fileContent);

      const result = replayService.parseDebugFile(debugFile);

      expect(result.envVars).to.deep.equal({ TESTOMATIO: 'test-key', TESTOMATIO_TITLE: 'Test Run' });
      expect(result.runParams).to.deep.equal({ title: 'Test Run', parallel: true });
      expect(result.finishParams).to.deep.equal({ status: 'finished', parallel: true });
      expect(result.tests).to.have.length(3);
      expect(result.tests[0]).to.deep.equal({ id: 'test1', status: 'passed', title: 'Test 1' });
      expect(result.tests[2]).to.deep.equal({ id: 'test3', status: 'passed', title: 'Test 3' });
      expect(result.parseErrors).to.equal(0);
      expect(result.totalLines).to.equal(5);
    });

    it('should handle parse errors gracefully', () => {
      const fileContent = [
        '{"valid": "json"}',
        'invalid json line',
        '{"another": "valid"}',
        'another invalid line',
        'yet another invalid',
        'fourth invalid'
      ].join('\n');

      fs.writeFileSync(debugFile, fileContent);

      const result = replayService.parseDebugFile(debugFile);

      expect(result.parseErrors).to.equal(4);
      expect(result.totalLines).to.equal(6);
      expect(mockErrors.length).to.equal(4); // 3 shown + 1 summary
    });

    it('should handle empty lines and whitespace', () => {
      const fileContent = [
        '{"action": "createRun", "params": {}}',
        '',
        '   ',
        '{"action": "addTest", "testId": {"id": "test1"}}'
      ].join('\n');

      fs.writeFileSync(debugFile, fileContent);

      const result = replayService.parseDebugFile(debugFile);

      expect(result.tests).to.have.length(1);
      expect(result.parseErrors).to.equal(0);
      expect(result.totalLines).to.equal(2); // Only non-empty lines counted
    });
  });

  describe('restoreEnvironmentVariables', () => {
    it('should restore environment variables', () => {
      const envVars = {
        TESTOMATIO: 'restored-key',
        TESTOMATIO_TITLE: 'Restored Title',
        NEW_VAR: 'new-value'
      };

      replayService.restoreEnvironmentVariables(envVars);

      expect(process.env.TESTOMATIO).to.equal('restored-key');
      expect(process.env.TESTOMATIO_TITLE).to.equal('Restored Title');
      expect(process.env.NEW_VAR).to.equal('new-value');
    });

    it('should not override existing environment variables', () => {
      process.env.EXISTING_VAR = 'existing-value';
      
      const envVars = {
        EXISTING_VAR: 'new-value',
        NEW_VAR: 'new-value'
      };

      replayService.restoreEnvironmentVariables(envVars);

      expect(process.env.EXISTING_VAR).to.equal('existing-value'); // Should not be overridden
      expect(process.env.NEW_VAR).to.equal('new-value');
    });
  });

  describe('replay', () => {
    let originalCreateRun;
    let originalAddTestRun;
    let originalUpdateRunStatus;
    let mockClient;

    beforeEach(() => {
      // Mock TestomatClient methods
      mockClient = {
        runId: 'test-run-id',
        createRunCalled: false,
        addTestRunCalls: [],
        updateRunStatusCalls: []
      };

      originalCreateRun = TestomatClient.prototype.createRun;
      originalAddTestRun = TestomatClient.prototype.addTestRun;
      originalUpdateRunStatus = TestomatClient.prototype.updateRunStatus;

      TestomatClient.prototype.createRun = function(params) {
        mockClient.createRunCalled = true;
        mockClient.createRunParams = params;
        this.runId = 'test-run-id';
        return Promise.resolve();
      };

      TestomatClient.prototype.addTestRun = function(status, test) {
        mockClient.addTestRunCalls.push({ status, test });
        return Promise.resolve();
      };

      TestomatClient.prototype.updateRunStatus = function(status, parallel) {
        mockClient.updateRunStatusCalls.push({ status, parallel });
        return Promise.resolve();
      };
    });

    afterEach(() => {
      TestomatClient.prototype.createRun = originalCreateRun;
      TestomatClient.prototype.addTestRun = originalAddTestRun;
      TestomatClient.prototype.updateRunStatus = originalUpdateRunStatus;
    });

    it('should use default debug file if none provided', async () => {
      const defaultFile = replayService.getDefaultDebugFile();
      const debugData = [
        { data: 'variables', testomatioEnvVars: {} },
        { action: 'createRun', params: {} },
        { action: 'addTest', testId: { id: 'test1', status: 'passed' } }
      ];

      fs.writeFileSync(defaultFile, debugData.map(line => JSON.stringify(line)).join('\n'));

      try {
        await replayService.replay();
        expect(mockLogs[0]).to.include(defaultFile);
      } finally {
        if (fs.existsSync(defaultFile)) {
          fs.unlinkSync(defaultFile);
        }
      }
    });

    it('should throw error if API key is missing', async () => {
      const serviceWithoutKey = new ReplayService({ apiKey: null });
      
      try {
        await serviceWithoutKey.replay(debugFile);
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err.message).to.include('TESTOMATIO API key not found');
      }
    });

    it('should return dry run results without sending data', async () => {
      const dryRunService = new ReplayService({
        apiKey: 'test-key',
        dryRun: true,
        onLog: mockOnLog
      });

      const debugData = [
        { data: 'variables', testomatioEnvVars: { TESTOMATIO: 'test-key' } },
        { action: 'createRun', params: { title: 'Test Run' } },
        { action: 'addTest', testId: { id: 'test1', status: 'passed' } },
        { actions: 'finishRun', params: { status: 'finished' } }
      ];

      fs.writeFileSync(debugFile, debugData.map(line => JSON.stringify(line)).join('\n'));

      const result = await dryRunService.replay(debugFile);

      expect(result.dryRun).to.be.true;
      expect(result.testsCount).to.equal(1);
      expect(result.envVars).to.deep.equal({ TESTOMATIO: 'test-key' });
      expect(result.runParams).to.deep.equal({ title: 'Test Run' });
      expect(result.finishParams).to.deep.equal({ status: 'finished' });

      // Should not have called any client methods
      expect(mockClient.createRunCalled).to.be.false;
      expect(mockClient.addTestRunCalls).to.have.length(0);
      expect(mockClient.updateRunStatusCalls).to.have.length(0);
    });

    it('should successfully replay tests', async () => {
      const debugData = [
        { data: 'variables', testomatioEnvVars: { TESTOMATIO: 'test-key' } },
        { action: 'createRun', params: { title: 'Test Run' } },
        { action: 'addTestsBatch', tests: [
          { id: 'test1', status: 'passed', title: 'Test 1' },
          { id: 'test2', status: 'failed', title: 'Test 2' }
        ]},
        { actions: 'finishRun', params: { status: 'finished', parallel: true } }
      ];

      fs.writeFileSync(debugFile, debugData.map(line => JSON.stringify(line)).join('\n'));

      const result = await replayService.replay(debugFile);

      expect(result.success).to.be.true;
      expect(result.testsCount).to.equal(2);
      expect(result.successCount).to.equal(2);
      expect(result.failureCount).to.equal(0);
      expect(result.runId).to.equal('test-run-id');

      expect(mockClient.createRunCalled).to.be.true;
      expect(mockClient.addTestRunCalls).to.have.length(2);
      expect(mockClient.updateRunStatusCalls).to.have.length(1);
      expect(mockClient.updateRunStatusCalls[0]).to.deep.equal({ status: 'finished', parallel: true });
    });

    it('should handle test upload failures gracefully', async () => {
      // Mock one failure
      let callCount = 0;
      TestomatClient.prototype.addTestRun = function(status, test) {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Upload failed'));
        }
        mockClient.addTestRunCalls.push({ status, test });
        return Promise.resolve();
      };

      const debugData = [
        { action: 'createRun', params: {} },
        { action: 'addTestsBatch', tests: [
          { id: 'test1', status: 'passed' },
          { id: 'test2', status: 'passed' }
        ]}
      ];

      fs.writeFileSync(debugFile, debugData.map(line => JSON.stringify(line)).join('\n'));

      const result = await replayService.replay(debugFile);

      expect(result.success).to.be.true;
      expect(result.testsCount).to.equal(2);
      expect(result.successCount).to.equal(1);
      expect(result.failureCount).to.equal(1);

      expect(mockErrors.some(err => err.includes('Failed to send test 1: Upload failed'))).to.be.true;
    });

    it('should call progress callback during test upload', async () => {
      const debugData = [
        { action: 'createRun', params: {} },
        { action: 'addTestsBatch', tests: [
          { id: 'test1', status: 'passed' },
          { id: 'test2', status: 'passed' },
          { id: 'test3', status: 'passed' }
        ]}
      ];

      fs.writeFileSync(debugFile, debugData.map(line => JSON.stringify(line)).join('\n'));

      await replayService.replay(debugFile);

      expect(mockProgress).to.have.length(3);
      
      const firstCall = mockProgress[0];
      expect(firstCall.current).to.equal(1);
      expect(firstCall.total).to.equal(3);
      expect(firstCall.success).to.be.true;
    });

    it('should use default finish status if not provided', async () => {
      const debugData = [
        { action: 'createRun', params: {} },
        { action: 'addTest', testId: { id: 'test1', status: 'passed' } }
        // No finishRun action
      ];

      fs.writeFileSync(debugFile, debugData.map(line => JSON.stringify(line)).join('\n'));

      await replayService.replay(debugFile);

      expect(mockClient.updateRunStatusCalls[0]).to.deep.equal({ 
        status: STATUS.FINISHED, 
        parallel: false 
      });
    });

    it('should throw error if no tests found', async () => {
      const debugData = [
        { action: 'createRun', params: {} }
        // No test data
      ];

      fs.writeFileSync(debugFile, debugData.map(line => JSON.stringify(line)).join('\n'));

      try {
        await replayService.replay(debugFile);
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err.message).to.include('No test data found in debug file');
      }
    });
  });

  describe('integration scenarios', () => {
    let originalCreateRun;
    let originalAddTestRun;
    let originalUpdateRunStatus;
    let mockClient;

    beforeEach(() => {
      mockClient = {
        runId: 'test-run-id',
        createRunCalled: false,
        addTestRunCalls: [],
        updateRunStatusCalls: []
      };

      originalCreateRun = TestomatClient.prototype.createRun;
      originalAddTestRun = TestomatClient.prototype.addTestRun;
      originalUpdateRunStatus = TestomatClient.prototype.updateRunStatus;

      TestomatClient.prototype.createRun = function() {
        mockClient.createRunCalled = true;
        this.runId = 'test-run-id';
        return Promise.resolve();
      };

      TestomatClient.prototype.addTestRun = function(status, test) {
        mockClient.addTestRunCalls.push({ status, test });
        return Promise.resolve();
      };

      TestomatClient.prototype.updateRunStatus = function(status, parallel) {
        mockClient.updateRunStatusCalls.push({ status, parallel });
        return Promise.resolve();
      };
    });

    afterEach(() => {
      TestomatClient.prototype.createRun = originalCreateRun;
      TestomatClient.prototype.addTestRun = originalAddTestRun;
      TestomatClient.prototype.updateRunStatus = originalUpdateRunStatus;
    });

    it('should handle mixed test data formats', async () => {
      const debugData = [
        { action: 'createRun', params: { title: 'Mixed Test Run' } },
        { action: 'addTestsBatch', tests: [
          { id: 'batch-test-1', status: 'passed' },
          { id: 'batch-test-2', status: 'failed' }
        ]},
        { action: 'addTest', testId: { id: 'individual-test-1', status: 'passed' } },
        { action: 'addTestsBatch', tests: [
          { id: 'batch-test-3', status: 'skipped' }
        ]},
        { action: 'addTest', testId: { id: 'individual-test-2', status: 'failed' } }
      ];

      fs.writeFileSync(debugFile, debugData.map(line => JSON.stringify(line)).join('\n'));

      const result = await replayService.replay(debugFile);

      expect(result.testsCount).to.equal(5);
      expect(result.successCount).to.equal(5);
    });

    it('should handle real-world debug file format', async () => {
      const debugData = [
        { t: '+0ms', datetime: '2024-01-15T10:30:00.000Z', timestamp: 1705315800000 },
        { t: '+5ms', data: 'variables', testomatioEnvVars: { 
          TESTOMATIO: 'test-api-key',
          TESTOMATIO_TITLE: 'Real Test Run',
          TESTOMATIO_ENV: 'staging'
        }},
        { t: '+10ms', data: 'store', store: {} },
        { t: '+15ms', action: 'createRun', params: { 
          title: 'Real Test Run',
          env: 'staging',
          parallel: true 
        }},
        { t: '+2000ms', action: 'addTestsBatch', tests: [
          {
            id: 'real-test-1',
            status: 'passed',
            title: 'User can login',
            time: 1500,
            steps: [
              { title: 'Navigate to login page', status: 'passed' },
              { title: 'Enter credentials', status: 'passed' },
              { title: 'Click login button', status: 'passed' }
            ]
          },
          {
            id: 'real-test-2',
            status: 'failed',
            title: 'User can logout',
            time: 800,
            error: 'Element not found: logout button',
            steps: [
              { title: 'Click user menu', status: 'passed' },
              { title: 'Click logout', status: 'failed', error: 'Element not found' }
            ]
          }
        ]},
        { t: '+3000ms', actions: 'finishRun', params: { status: 'finished', parallel: true } }
      ];

      fs.writeFileSync(debugFile, debugData.map(line => JSON.stringify(line)).join('\n'));

      const result = await replayService.replay(debugFile);

      expect(result.success).to.be.true;
      expect(result.testsCount).to.equal(2);
      expect(result.envVars).to.deep.include({
        TESTOMATIO: 'test-api-key',
        TESTOMATIO_TITLE: 'Real Test Run',
        TESTOMATIO_ENV: 'staging'
      });
    });
  });
}); 