import { expect } from 'chai';
import { CodeceptTestRunner } from './utils/codecept.js';

describe('CodeceptJS Steps and Sections Reporting', function() {
  this.timeout(60000);

  let testRunner;

  before(() => {
    testRunner = new CodeceptTestRunner();
    testRunner.setupTestEnvironment();
  });

  afterEach(() => {
    testRunner.cleanupTestEnvironment();
  });

  // Unified helper function using testRunner with grep support
  async function runCodeceptTest(testGrep, extraEnv = {}) {
    const testConfig = {
      testFile: 'steps_sections_test.js',
      grep: testGrep
    };
    
    const result = await testRunner.runCodeceptTest(testConfig, extraEnv);

    // Verify debug data was created
    expect(result.debugData.length).to.be.greaterThan(0);
    
    return result;
  }

  describe('Section Formatting in Steps', () => {
    it('should preserve Section formatting in passed test steps', async () => {
      const { testEntries } = await runCodeceptTest('Test with multiple sections and steps');
      
      expect(testEntries.length).to.equal(1);
      const testEntry = testEntries[0];
      
      
      // Check basic test properties
      expect(testEntry.testId.status).to.equal('passed');
      expect(testEntry.testId.title).to.equal('Test with multiple sections and steps');
      
      // Check that steps field contains array of step objects
      const steps = testEntry.testId.steps;
      expect(steps).to.be.an('array');
      expect(steps.length).to.be.greaterThan(0);
      
      // Find section steps
      const userAuthSection = steps.find(step => step.title.includes('User Authentication'));
      const dataProcessingSection = steps.find(step => step.title.includes('Data Processing'));
      const resultVerificationSection = steps.find(step => step.title.includes('Result Verification'));
      
      expect(userAuthSection).to.exist;
      expect(dataProcessingSection).to.exist;
      expect(resultVerificationSection).to.exist;
      
      // Verify sections have nested steps
      expect(userAuthSection.steps).to.be.an('array');
      expect(dataProcessingSection.steps).to.be.an('array');
      expect(resultVerificationSection.steps).to.be.an('array');
      
      // Check stack field formatting
      const stack = testEntry.testId.stack;
      expect(stack).to.include('################[ Logs ]################');
      expect(stack).to.include('User Authentication');
      expect(stack).to.include('Data Processing');
      expect(stack).to.include('Result Verification');
    });

    it('should preserve Section formatting in failed test steps', async () => {
      const { testEntries } = await runCodeceptTest('Test with failing step in section');
      
      expect(testEntries.length).to.equal(1);
      const testEntry = testEntries[0];
      
      // Check basic test properties
      expect(testEntry.testId.status).to.equal('failed');
      expect(testEntry.testId.title).to.equal('Test with failing step in section');
      
      // Check that steps field contains array of step objects
      const steps = testEntry.testId.steps;
      expect(steps).to.be.an('array');
      expect(steps.length).to.be.greaterThan(0);
      
      // Find section steps
      const successfulSection = steps.find(step => step.title.includes('Successful Operations'));
      const failureSection = steps.find(step => step.title.includes('Operations with Failure'));
      
      expect(successfulSection).to.exist;
      expect(failureSection).to.exist;
      
      // Check stack field includes both steps and failure info
      const stack = testEntry.testId.stack;
      expect(stack).to.include('################[ Logs ]################');
      expect(stack).to.include('################[ Failure ]################');
      expect(stack).to.include('Successful Operations');
      expect(stack).to.include('Operations with Failure');
      expect(stack).to.include('AssertionError');
    });

    it('should handle complex nested sections properly', async () => {
      const { testEntries } = await runCodeceptTest('Test with complex data operations');
      
      expect(testEntries.length).to.equal(1);
      const testEntry = testEntries[0];
      
      // Check basic test properties
      expect(testEntry.testId.status).to.equal('passed');
      expect(testEntry.testId.title).to.equal('Test with complex data operations');
      
      // Check that steps field contains array of step objects
      const steps = testEntry.testId.steps;
      expect(steps).to.be.an('array');
      expect(steps.length).to.be.greaterThan(0);
      
      // Verify all section headers are present in step titles
      const stepTitles = steps.map(step => step.title || step).join(' ');
      expect(stepTitles).to.include('Array Operations');
      expect(stepTitles).to.include('Object Operations');
      expect(stepTitles).to.include('Mathematical Operations');
      
      // Verify proper indentation and multiple steps per section
      expect(stepTitles).to.include('I expectEqual');
      expect(stepTitles).to.include('I expectTrue');
      expect(stepTitles).to.include('I expectFalse');
      
      // Check that sections contain multiple steps
      const stepsString = stepTitles;
      const arraySection = stepsString.split('Object Operations')[0];
      const objectSection = stepsString.split('Mathematical Operations')[0].split('Object Operations')[1];
      const mathSection = stepsString.split('Mathematical Operations')[1];
      
      // Each section should have multiple steps
      expect((arraySection.match(/I expect/g) || []).length).to.be.greaterThan(2);
      expect((objectSection.match(/I expect/g) || []).length).to.be.greaterThan(2);
      expect((mathSection.match(/I expect/g) || []).length).to.be.greaterThan(2);
    });
  });

  describe('Step Timing and Metadata', () => {
    it('should include step timing information', async () => {
      const { testEntries } = await runCodeceptTest('Test with multiple sections and steps');
      
      const testEntry = testEntries[0];
      const steps = testEntry.testId.steps;
      
      // Check that steps contain duration information
      expect(steps).to.be.an('array');
      const stepWithDuration = steps.find(step => step.duration && step.duration > 0);
      expect(stepWithDuration).to.exist;
    });

    it('should handle steps without timing gracefully', async () => {
      const { testEntries } = await runCodeceptTest('Test with complex data operations');
      
      const testEntry = testEntries[0];
      const steps = testEntry.testId.steps;
      
      // Steps should be properly formatted even without timing
      expect(steps).to.be.an('array');
      const hasExpectEqualStep = steps.some(step => 
        step.title.includes('I expect equal') || 
        (step.steps && step.steps.some(nestedStep => nestedStep.title.includes('I expect equal')))
      );
      expect(hasExpectEqualStep).to.be.true;
    });
  });

  describe('Integration with Reporter', () => {
    it('should maintain step formatting consistency across test types', async () => {
      // Run multiple tests and verify consistent formatting
      const { testEntries: passedEntries } = await runCodeceptTest('Test with multiple sections and steps');
      const { testEntries: failedEntries } = await runCodeceptTest('Test with failing step in section');
      
      expect(passedEntries.length).to.equal(1);
      expect(failedEntries.length).to.equal(1);
      
      const passedTest = passedEntries[0];
      const failedTest = failedEntries[0];
      
      // Both should have properly formatted steps as arrays
      expect(passedTest.testId.steps).to.be.an('array');
      expect(failedTest.testId.steps).to.be.an('array');
      
      // Both should have sections with nested steps
      const passedHasNestedSteps = passedTest.testId.steps.some(step => step.steps && step.steps.length > 0);
      const failedHasNestedSteps = failedTest.testId.steps.some(step => step.steps && step.steps.length > 0);
      expect(passedHasNestedSteps).to.be.true;
      expect(failedHasNestedSteps).to.be.true;
      
      // Both should have stack field with logs header
      expect(passedTest.testId.stack).to.include('################[ Logs ]################');
      expect(failedTest.testId.stack).to.include('################[ Logs ]################');
      
      // Failed test should also have failure section
      expect(failedTest.testId.stack).to.include('################[ Failure ]################');
      expect(passedTest.testId.stack).to.not.include('################[ Failure ]################');
    });

    it('should properly escape and format step content', async () => {
      const { testEntries } = await runCodeceptTest('Test with complex data operations');
      
      const testEntry = testEntries[0];
      const steps = testEntry.testId.steps;
      
      // Check that quoted strings are properly handled in step titles
      expect(steps).to.be.an('array');
      const hasTestObjectStep = steps.some(step => 
        step.title.includes('"test object"') || 
        (step.steps && step.steps.some(nestedStep => nestedStep.title.includes('"test object"')))
      );
      expect(hasTestObjectStep).to.be.true;
      
      // Check that numbers are properly formatted in step titles
      const hasNumberSteps = steps.some(step => 
        step.title.includes('42') || 
        (step.steps && step.steps.some(nestedStep => nestedStep.title.includes('42')))
      );
      expect(hasNumberSteps).to.be.true;
    });
  });
});