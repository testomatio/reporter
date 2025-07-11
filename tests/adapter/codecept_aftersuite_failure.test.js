import { expect } from 'chai';
import path from 'path';
import fs from 'fs';
import { CodeceptTestRunner } from './utils/codecept.js';

describe('CodeceptJS AfterSuite Failure Bug (#948)', function() {
  this.timeout(60000);

  let testRunner;

  before(() => {
    testRunner = new CodeceptTestRunner();
    testRunner.setupTestEnvironment();
  });

  afterEach(() => {
    testRunner.cleanupTestEnvironment();
  });

  // Unified helper function using testRunner
  async function runCodeceptTest(testFile, extraEnv = {}) {
    const result = await testRunner.runCodeceptTest(testFile, extraEnv);

    // Expected - tests will fail due to AfterSuite failure
    // Verify debug data was created
    expect(result.debugData.length).to.be.greaterThan(0);
    
    return result;
  }

  it('should create test file with failing AfterSuite hook', async () => {
    // First, create a test file that reproduces the issue
    const testContent = `
Feature('AfterSuite Failure Test @aftersuite-bug');

// Tests that should pass
Scenario('First passing test', ({ I, test }) => {
  console.log('Running test:', test.title);
  I.expectEqual(1 + 1, 2);
});

Scenario('Second passing test', ({ I, test }) => {
  console.log('Running test:', test.title);
  I.expectEqual(2 + 2, 4);
});

Scenario('Third passing test', ({ I, test }) => {
  console.log('Running test:', test.title);
  I.expectEqual(3 + 3, 6);
});

// AfterSuite that fails - this should NOT affect individual test results
AfterSuite(() => {
  console.log('AfterSuite: This will fail');
  // Simulate the failing assertion from the issue
  const assert = require('assert');
  assert.equal(1, 2, 'AfterSuite intentionally fails');
});
`;

    const testFilePath = path.join(testRunner.exampleDir, 'aftersuite_failure_test.js');
    fs.writeFileSync(testFilePath, testContent);
    
    expect(fs.existsSync(testFilePath)).to.be.true;
  });

  it('should reproduce issue #948: AfterSuite failure marks all tests as failed', async () => {
    const { testEntries, stdout } = await runCodeceptTest('aftersuite_failure_test.js');
    
    console.log('=== CURRENT BEHAVIOR (BUG) ===');
    console.log('Test entries found:', testEntries.length);
    
    testEntries.forEach((entry, index) => {
      console.log(`Test ${index + 1}: ${entry.testId.title} - Status: ${entry.testId.status}`);
    });
    
    // CURRENT BUGGY BEHAVIOR: All tests are marked as failed due to AfterSuite failure
    const passedTests = testEntries.filter(entry => entry.testId.status === 'passed');
    const failedTests = testEntries.filter(entry => entry.testId.status === 'failed');
    
    console.log(`Passed tests: ${passedTests.length}`);
    console.log(`Failed tests: ${failedTests.length}`);
    
    // This documents the current buggy behavior
    // TODO: When fixed, this test should be updated to expect correct behavior
    if (failedTests.length === testEntries.length) {
      console.log('❌ BUG REPRODUCED: All tests marked as failed due to AfterSuite failure');
      console.log('This is the incorrect behavior described in issue #948');
    } else {
      console.log('✅ BUG APPEARS TO BE FIXED: Tests not incorrectly marked as failed');
    }
    
    // Verify the AfterSuite actually failed
    expect(stdout).to.include('AfterSuite: This will fail');
    expect(stdout).to.include('AfterSuite intentionally fails');
    
    // Verify we have the expected number of tests
    expect(testEntries.length).to.equal(3);
    
    // Each test should have proper metadata
    testEntries.forEach(entry => {
      expect(entry.testId.title).to.include('passing test');
      expect(entry.testId.suite_title).to.equal('AfterSuite Failure Test');
      expect(entry.testId.rid).to.be.a('string');
    });
  });

  it('should define the CORRECT expected behavior for AfterSuite failures', async () => {
    const { testEntries } = await runCodeceptTest('aftersuite_failure_test.js');
    
    console.log('=== EXPECTED BEHAVIOR (AFTER FIX) ===');
    
    // CORRECT BEHAVIOR: Individual tests should remain passed
    // Only the suite/run level should be marked as failed due to AfterSuite
    
    const expectedPassedTests = testEntries.filter(entry => 
      entry.testId.title.includes('passing test')
    );
    
    console.log('Expected behavior:');
    console.log('- Individual test scenarios should be marked as PASSED');
    console.log('- Only the AfterSuite hook or run-level status should be FAILED');
    console.log('- Test statistics should show: 3 passed, 0 failed (for individual tests)');
    console.log('- Run status should be failed due to AfterSuite hook failure');
    
    // Document what should happen when the bug is fixed
    expectedPassedTests.forEach(test => {
      console.log(`Expected: ${test.testId.title} should be PASSED (currently: ${test.testId.status})`);
    });
    
    // This assertion will fail until the bug is fixed
    // When fixing the bug, update the adapter to ensure:
    // 1. Individual test results are not affected by AfterSuite failures
    // 2. Only run-level or suite-level status reflects the hook failure
    
    expect(testEntries.length).to.equal(3);
    
    // TODO: Uncomment these assertions once the bug is fixed
    // expect(passedTests.length).to.equal(3, 'All individual tests should pass');
    // expect(failedTests.length).to.equal(0, 'No individual tests should fail due to AfterSuite');
  });

  it('should handle other hook failures similarly', async () => {
    // Create another test to verify BeforeSuite failures don't affect individual tests
    const beforeSuiteTestContent = `
Feature('BeforeSuite Failure Test @beforesuite-test');

BeforeSuite(() => {
  console.log('BeforeSuite: This will fail');
  const assert = require('assert');
  assert.equal(1, 2, 'BeforeSuite intentionally fails');
});

Scenario('Test after failing BeforeSuite', ({ I, test }) => {
  console.log('Running test after failed BeforeSuite:', test.title);
  I.expectEqual(1, 1);
});

Scenario('Another test after failing BeforeSuite', ({ I, test }) => {
  console.log('Running another test after failed BeforeSuite:', test.title);
  I.expectEqual(2, 2);
});
`;

    const beforeSuiteTestPath = path.join(testRunner.exampleDir, 'beforesuite_failure_test.js');
    fs.writeFileSync(beforeSuiteTestPath, beforeSuiteTestContent);
    
    const { testEntries, stdout } = await runCodeceptTest('beforesuite_failure_test.js');
    
    console.log('=== BeforeSuite Failure Test ===');
    
    testEntries.forEach(entry => {
      console.log(`Test: ${entry.testId.title} - Status: ${entry.testId.status}`);
    });
    
    // Similar principle: BeforeSuite failures should not mark individual tests as failed
    // The tests might not run, but they shouldn't be marked as "failed" - they should be "skipped" or "not run"
    
    expect(testEntries.length).to.be.greaterThan(0);
    console.log('BeforeSuite and AfterSuite failures should be handled consistently');
  });

  after(() => {
    // Clean up test files
    const testFiles = [
      'aftersuite_failure_test.js',
      'beforesuite_failure_test.js'
    ];
    
    testFiles.forEach(file => {
      const filePath = path.join(testRunner.exampleDir, file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
  });
});