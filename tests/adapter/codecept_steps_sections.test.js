import { expect } from 'chai';
import { runTests, runWorkers, CodeceptTestRunner } from './utils/codecept.js';

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

  // Remove custom runCodeceptTest helper
  // Use runTests or runWorkers directly in tests

  describe('Section Formatting in Steps', () => {
    it('should preserve Section formatting in passed test steps', async () => {
      const { testEntries } = await runTests({
        testFile: 'steps_sections_test.js',
        grep: 'Test with multiple sections and steps'
      });
      
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
      const { testEntries } = await runTests({
        testFile: 'steps_sections_test.js',
        grep: 'Test with failing step in section'
      });
      
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
      const { testEntries } = await runTests({
        testFile: 'steps_sections_test.js',
        grep: 'Test with complex data operations'
      });
      
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
      
      // Verify that we have the main step types
      expect(stepTitles).to.include('I say "Testing comprehensive data structure operations"');
      expect(stepTitles).to.include('Array Operations');
      expect(stepTitles).to.include('Object Operations');
      
      // Verify we have the expected number of top-level steps (1 say + 3 sections = 4)
      expect(steps.length).to.equal(4);
      
      // Verify that sections have nested steps
      const arrayOperationsStep = steps.find(step => step.title === 'Array Operations');
      const objectOperationsStep = steps.find(step => step.title === 'Object Operations');
      const mathOperationsStep = steps.find(step => step.title === 'Mathematical Operations');
      
      expect(arrayOperationsStep).to.exist;
      expect(objectOperationsStep).to.exist;
      expect(mathOperationsStep).to.exist;
      
      // Each section should have nested steps
      expect(arrayOperationsStep.steps).to.be.an('array');
      expect(objectOperationsStep.steps).to.be.an('array');
      expect(mathOperationsStep.steps).to.be.an('array');
    });
  });

  describe('Step Timing and Metadata', () => {
    it('should include step timing information', async () => {
      const { testEntries } = await runTests({
        testFile: 'steps_sections_test.js',
        grep: 'Test with multiple sections and steps'
      });
      
      const testEntry = testEntries[0];
      const steps = testEntry.testId.steps;
      
      // Check that steps contain duration information
      expect(steps).to.be.an('array');
      const stepWithDuration = steps.find(step => step.duration && step.duration > 0);
      expect(stepWithDuration).to.exist;
    });

    it('should handle steps without timing gracefully', async () => {
      const { testEntries } = await runTests({
        testFile: 'steps_sections_test.js',
        grep: 'Test with complex data operations'
      });
      
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
      const { testEntries: passedEntries } = await runTests({
        testFile: 'steps_sections_test.js',
        grep: 'Test with multiple sections and steps'
      });
      const { testEntries: failedEntries } = await runTests({
        testFile: 'steps_sections_test.js',
        grep: 'Test with failing step in section'
      });
      
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
      const { testEntries } = await runTests({
        testFile: 'steps_sections_test.js',
        grep: 'Test with complex data operations'
      });
      
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