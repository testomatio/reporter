import { expect } from 'chai';
import fs from 'fs';
import path from 'path';
import { CodeceptTestRunner } from './utils/codecept.js';

describe('CodeceptJS Adapter Tests', function() {
  this.timeout(60000); // Longer timeout for test execution

  let testRunner;

  before(() => {
    testRunner = new CodeceptTestRunner();
    testRunner.setupTestEnvironment();
  });

  afterEach(() => {
    testRunner.cleanupTestEnvironment();
  });

  // Unified helper function using testRunner
  async function runCodeceptTest(testFile = 'simple_test.js', extraEnv = {}) {
    const result = await testRunner.runCodeceptTest(testFile, extraEnv);

    // Verify debug data was created
    expect(result.debugData.length).to.be.greaterThan(0);
    expect(result.testEntries.length).to.be.greaterThan(0);
    
    return result;
  }

  describe('Basic Functionality', () => {
    it('should execute tests and generate debug data', async () => {
      const { stdout, debugData, testEntries } = await runCodeceptTest();
      
      // Verify test execution
      expect(stdout).to.include('Simple Tests');
      expect(stdout).to.include('should always pass');
      expect(stdout).to.include('should always fail');
      
      // Should have 1 passed and 1 failed
      expect(stdout).to.match(/1 passed.*1 failed/);
      
      // Verify debug data
      expect(testEntries.length).to.equal(2); // exactly 2 tests
      expect(debugData.length).to.be.greaterThan(0);
    });
  });

  describe('Test Execution Results', () => {
    it('should handle both passing and failing tests', async () => {
      const { stdout } = await runCodeceptTest();
      
      // Check for pass/fail indicators
      expect(stdout).to.include('✔ should always pass');
      expect(stdout).to.include('✖ should always fail');
      
      // Check for failure details
      expect(stdout).to.include('expected 2 to equal 3');
      expect(stdout).to.include('AssertionError');
    });
  });

  describe('Configuration', () => {
    it('should use testomat plugin configuration', async () => {
      // Read the codecept config to verify testomat plugin is configured
      const configPath = path.join(testRunner.exampleDir, 'codecept.conf.js');
      const configContent = fs.readFileSync(configPath, 'utf-8');
      
      expect(configContent).to.include('testomat');
      expect(configContent).to.include('../../lib/adapter/codecept');
    });

    it('should handle TESTOMATIO environment variable', async () => {
      const { stdout } = await runCodeceptTest('simple_test.js', {
        TESTOMATIO: 'custom-test-key'
      });
      
      // Test should still run (regardless of whether reporting works)
      expect(stdout).to.include('Simple Tests');
    });
  });

  describe('File Structure', () => {
    it('should have simple test file with correct structure', () => {
      const testFilePath = path.join(testRunner.exampleDir, 'simple_test.js');
      expect(fs.existsSync(testFilePath)).to.be.true;
      
      const testContent = fs.readFileSync(testFilePath, 'utf-8');
      expect(testContent).to.include('Feature(\'Simple Tests\')');
      expect(testContent).to.include('should always pass');
      expect(testContent).to.include('should always fail');
    });

    it('should have package.json configured for CommonJS', () => {
      const packagePath = path.join(testRunner.exampleDir, 'package.json');
      expect(fs.existsSync(packagePath)).to.be.true;
      
      const packageContent = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
      expect(packageContent.type).to.equal('commonjs');
    });
  });

  describe('Debug Pipe Integration', () => {
    it('should capture test metadata and status', async () => {
      const { testEntries } = await runCodeceptTest();
      
      // Should have exactly 2 tests
      expect(testEntries.length).to.equal(2);
      
      // Find passing and failing tests
      const passingTest = testEntries.find(entry => entry.testId.status === 'passed');
      const failingTest = testEntries.find(entry => entry.testId.status === 'failed');
      
      expect(passingTest).to.exist;
      expect(passingTest.testId.title).to.equal('should always pass');
      expect(passingTest.testId.suite_title).to.equal('Simple Tests');
      
      expect(failingTest).to.exist;
      expect(failingTest.testId.title).to.equal('should always fail');
      expect(failingTest.testId.suite_title).to.equal('Simple Tests');
      expect(failingTest.testId.message).to.include('expected 2 to equal 3');
    });

    it('should capture test execution metadata', async () => {
      const { testEntries } = await runCodeceptTest();
      
      // Check that all tests have required metadata
      testEntries.forEach(entry => {
        expect(entry.testId).to.exist;
        expect(entry.testId.rid).to.be.a('string');
        expect(entry.testId.title).to.be.a('string');
        expect(entry.testId.suite_title).to.equal('Simple Tests');
        expect(entry.testId.run_time).to.be.a('number');
        expect(entry.testId.status).to.be.oneOf(['passed', 'failed']);
        expect(entry.testId.meta).to.be.an('object');
      });
    });

    it('should handle test failures with proper error information', async () => {
      const { testEntries } = await runCodeceptTest();
      
      const failingTest = testEntries.find(entry => entry.testId.status === 'failed');
      expect(failingTest).to.exist;
      
      // Should have error details
      expect(failingTest.testId.stack).to.include('AssertionError');
      expect(failingTest.testId.stack).to.include('expected 2 to equal 3');
      expect(failingTest.testId.message).to.include('expected 2 to equal 3');
    });
  });
});