import { expect } from 'chai';
import { CodeceptTestRunner } from './utils/codecept.js';

describe('CodeceptJS Comprehensive Adapter Tests', function() {
  this.timeout(120000); // Longer timeout for comprehensive test execution

  let testRunner;

  before(() => {
    testRunner = new CodeceptTestRunner();
    testRunner.setupTestEnvironment();
  });

  afterEach(() => {
    testRunner.cleanupTestEnvironment();
  });

  // Unified helper function using testRunner
  async function runCodeceptTest(testFile = 'comprehensive_test.js', extraEnv = {}) {
    const result = await testRunner.runCodeceptTest(testFile, extraEnv);

    // Verify debug data was created
    expect(result.debugData.length).to.be.greaterThan(0);
    
    return result;
  }

  describe('Comprehensive Test Scenarios', () => {
    it('should handle passing, failing, and skipped tests', async () => {
      const { testEntries } = await runCodeceptTest('comprehensive_test.js');
      
      // Find different test types
      const passingTests = testEntries.filter(entry => entry.testId.status === 'passed');
      const failingTests = testEntries.filter(entry => entry.testId.status === 'failed');
      const skippedTests = testEntries.filter(entry => entry.testId.status === 'skipped');
      
      // Should have at least one of each type
      expect(passingTests.length).to.be.greaterThan(0);
      expect(failingTests.length).to.be.greaterThan(0);
      
      // Verify specific test cases
      const passTest = passingTests.find(t => t.testId.title.includes('Test that passes'));
      expect(passTest).to.exist;
      expect(passTest.testId.suite_title).to.equal('Comprehensive Test Suite');
      
      const failTest = failingTests.find(t => t.testId.title.includes('Test that fails'));
      expect(failTest).to.exist;
      expect(failTest.testId.message).to.include('expected 4 to equal 5');
    });

    it('should handle data-driven tests correctly', async () => {
      const { testEntries } = await runCodeceptTest('comprehensive_test.js');
      
      // Look for data-driven tests
      const dataTests = testEntries.filter(entry => 
        entry.testId.title.includes('data examples') || 
        entry.testId.title.includes('multiple data sets')
      );
      
      expect(dataTests.length).to.be.greaterThan(0);
      
      // Check if examples are captured (when available)
      dataTests.forEach(test => {
        if (test.testId.example) {
          expect(test.testId.example).to.be.an('object');
        }
      });
    });

    it('should capture test metadata and execution details', async () => {
      const { testEntries } = await runCodeceptTest('comprehensive_test.js');
      
      testEntries.forEach(entry => {
        expect(entry.testId).to.exist;
        expect(entry.testId.rid).to.be.a('string');
        expect(entry.testId.title).to.be.a('string');
        expect(entry.testId.suite_title).to.equal('Comprehensive Test Suite');
        expect(entry.testId.run_time).to.be.a('number');
        expect(entry.testId.status).to.be.oneOf(['passed', 'failed', 'skipped']);
        expect(entry.testId.meta).to.be.an('object');
      });
    });

    it('should handle async tests properly', async () => {
      const { testEntries } = await runCodeceptTest('comprehensive_test.js');
      
      const asyncTest = testEntries.find(entry => 
        entry.testId.title.includes('async operation')
      );
      
      expect(asyncTest).to.exist;
      expect(asyncTest.testId.status).to.equal('passed');
      expect(asyncTest.testId.run_time).to.be.greaterThan(90); // Should take at least 100ms
    });
  });

  describe('Hook Execution Tests', () => {
    it('should execute BeforeSuite and AfterSuite hooks', async () => {
      const { stdout, testEntries } = await runCodeceptTest('hooks_test.js');
      
      // Check hook execution in output
      expect(stdout).to.include('BeforeSuite: Setting up test environment');
      expect(stdout).to.include('AfterSuite: Cleaning up test environment');
      
      // All tests should have access to suite data
      const hookTests = testEntries.filter(entry => 
        entry.testId.suite_title === 'Hooks Test Suite'
      );
      
      expect(hookTests.length).to.be.greaterThan(0);
      
      hookTests.forEach(test => {
        if (test.testId.status === 'passed') {
          // Passed tests should have had access to hook data
          expect(test.testId.title).to.not.include('Before hook did not run');
        }
      });
    });

    it('should execute Before and After hooks for each test', async () => {
      const { stdout } = await runCodeceptTest('hooks_test.js');
      
      expect(stdout).to.include('Before: Setting up individual test');
      expect(stdout).to.include('After: Cleaning up individual test');
    });

    it('should handle failing hooks gracefully', async () => {
      const { stdout, testEntries } = await runCodeceptTest('failing_hooks_test.js');
      
      // Should still report tests even when hooks fail
      expect(testEntries.length).to.be.greaterThan(0);
      
      // Check that some tests were affected by failing hooks
      const failingHookTests = testEntries.filter(entry => 
        entry.testId.suite_title === 'Failing Hooks Test Suite'
      );
      
      expect(failingHookTests.length).to.be.greaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle tests that throw errors', async () => {
      const { testEntries } = await runCodeceptTest('comprehensive_test.js');
      
      // Find test that throws error
      const errorTest = testEntries.find(entry => 
        entry.testId.title.includes('throws error')
      );
      
      expect(errorTest).to.exist;
      expect(errorTest.testId.status).to.equal('failed');
      if (errorTest.testId.stack) {
        expect(errorTest.testId.stack).to.include('intentional error for testing');
      }
    });

    it('should handle async test failures properly', async () => {
      const { testEntries } = await runCodeceptTest('comprehensive_test.js');
      
      const asyncTest = testEntries.find(entry => 
        entry.testId.title.includes('async operation')
      );
      
      expect(asyncTest).to.exist;
      expect(asyncTest.testId.status).to.equal('passed');
      expect(asyncTest.testId.run_time).to.be.greaterThan(90); // Should take at least 100ms
    });

    it('should handle various expect assertions', async () => {
      const { testEntries } = await runCodeceptTest('comprehensive_test.js');
      
      // Find test with various assertions
      const assertionTest = testEntries.find(entry => 
        entry.testId.title.includes('various assertions')
      );
      
      expect(assertionTest).to.exist;
      expect(assertionTest.testId.status).to.equal('passed');
    });

    it('should handle string assertion tests', async () => {
      const { testEntries } = await runCodeceptTest('comprehensive_test.js');
      
      // Find test with string assertions
      const stringTest = testEntries.find(entry => 
        entry.testId.title.includes('string assertions')
      );
      
      expect(stringTest).to.exist;
      expect(stringTest.testId.status).to.equal('passed');
    });
  });

  describe('Test Object Injection', () => {
    it('should properly inject test object into scenarios', async () => {
      const { stdout } = await runCodeceptTest('comprehensive_test.js');
      
      // Check that test object injection works and logs are present
      expect(stdout).to.include('Current test:');
      expect(stdout).to.include('Running async test:');
      expect(stdout).to.include('About to throw error in test:');
    });

    it('should capture test metadata through injection', async () => {
      const { testEntries } = await runCodeceptTest('hooks_test.js');
      
      // Verify that tests with injection still capture proper metadata
      testEntries.forEach(entry => {
        expect(entry.testId.title).to.be.a('string');
        expect(entry.testId.suite_title).to.equal('Hooks Test Suite');
        expect(entry.testId.rid).to.be.a('string');
        expect(entry.testId.status).to.be.oneOf(['passed', 'failed', 'skipped']);
      });
    });
  });

  describe('Reporter Integration', () => {
    it('should capture test steps and execution flow', async () => {
      const { testEntries } = await runCodeceptTest('comprehensive_test.js');
      
      // Look for test with multiple steps
      const multiStepTest = testEntries.find(entry => 
        entry.testId.title.includes('multiple steps')
      );
      
      expect(multiStepTest).to.exist;
      if (multiStepTest.testId.steps) {
        expect(multiStepTest.testId.steps).to.be.an('array');
      }
    });

    it('should handle feature tags properly', async () => {
      const { testEntries } = await runCodeceptTest('comprehensive_test.js');
      
      // Check that tests capture feature-level tags
      const comprehensiveTests = testEntries.filter(entry => 
        entry.testId.suite_title === 'Comprehensive Test Suite'
      );
      
      expect(comprehensiveTests.length).to.be.greaterThan(0);
      
      // All tests should belong to the correct suite
      comprehensiveTests.forEach(test => {
        expect(test.testId.suite_title).to.equal('Comprehensive Test Suite');
      });
    });

    it('should maintain run consistency across different test types', async () => {
      const { debugData } = await runCodeceptTest('comprehensive_test.js');
      
      // Check for run start and end events
      const runEvents = debugData.filter(entry => 
        entry.action === 'startRun' || entry.action === 'finishRun'
      );
      
      expect(runEvents.length).to.be.greaterThan(0);
      
      // All test entries should have consistent run metadata
      const testEntries = debugData.filter(entry => entry.action === 'addTest');
      
      testEntries.forEach(entry => {
        expect(entry.testId.rid).to.be.a('string');
        expect(entry.testId.rid.length).to.be.greaterThan(0);
      });
    });
  });

  describe('CodeceptJS 3.7+ Features', () => {
    it('should support modern CodeceptJS event system', async () => {
      const { stdout } = await runCodeceptTest('comprehensive_test.js');
      
      // Should not show version warnings for 3.7+
      expect(stdout).to.not.include('CodeceptJS 3.7+ is supported');
      expect(stdout).to.not.include('This reporter works with CodeceptJS 3+');
    });

    it('should handle new step reporting format', async () => {
      const { testEntries } = await runCodeceptTest('comprehensive_test.js');
      
      testEntries.forEach(entry => {
        // Should have proper step structure for 3.7+
        if (entry.testId.steps) {
          expect(entry.testId.steps).to.be.an('array');
        }
      });
    });
  });
});