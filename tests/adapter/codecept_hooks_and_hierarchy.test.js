import { expect } from 'chai';
import { CodeceptTestRunner } from './codecept-test-utils.js';

describe('CodeceptJS Hooks and Step Hierarchy', function() {
  this.timeout(120000);

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
    
    console.log('Test execution output:', result.stdout);
    if (result.stderr) console.log('Test execution stderr:', result.stderr);

    // Verify debug data was created
    expect(result.debugData.length).to.be.greaterThan(0);
    
    // Filter for both addTest and addTestsBatch actions for compatibility
    const testEntries = result.debugData.filter(entry => entry.action === 'addTestsBatch' || entry.action === 'addTest');
    
    return { ...result, testEntries };
  }

  describe('Hook Step Capture', () => {
    it('should capture steps executed in hooks', async () => {
      const { testEntries } = await runCodeceptTest('hooks_with_steps_test.js');
      
      expect(testEntries.length).to.be.greaterThan(0);
      
      // Get the test data from addTestsBatch
      let testData;
      if (testEntries[0].action === 'addTestsBatch') {
        testData = testEntries[0].tests[0];
      } else {
        testData = testEntries[0].testId;
      }
      
      expect(testData.steps).to.be.an('array');
      
      // Should have hook steps with correct structure
      const hookSteps = testData.steps.filter(step => step.category === 'hook');
      expect(hookSteps.length).to.be.greaterThan(0);
      
      // Check for specific hooks
      const beforeSuiteStep = hookSteps.find(step => step.title === 'BeforeSuite');
      const beforeStep = hookSteps.find(step => step.title === 'Before');
      const afterStep = hookSteps.find(step => step.title === 'After');
      
      expect(beforeSuiteStep).to.exist;
      expect(beforeStep).to.exist;
      expect(afterStep).to.exist;
      
      // Each hook should have nested steps
      expect(beforeSuiteStep.steps).to.be.an('array');
      expect(beforeSuiteStep.steps.length).to.be.greaterThan(0);
      expect(beforeStep.steps).to.be.an('array'); 
      expect(beforeStep.steps.length).to.be.greaterThan(0);
      expect(afterStep.steps).to.be.an('array');
      expect(afterStep.steps.length).to.be.greaterThan(0);
    });

    it('should correctly categorize hook steps', async () => {
      const { testEntries } = await runCodeceptTest('hooks_with_steps_test.js');
      
      // Get the test data
      let testData;
      if (testEntries[0].action === 'addTestsBatch') {
        testData = testEntries[0].tests[0];
      } else {
        testData = testEntries[0].testId;
      }
      
      const hookSteps = testData.steps.filter(step => step.category === 'hook');
      
      hookSteps.forEach(hookStep => {
        expect(hookStep.category).to.equal('hook');
        expect(hookStep.title).to.be.oneOf(['BeforeSuite', 'Before', 'After', 'AfterSuite']);
        
        // Each hook's child steps should be categorized as 'user'
        hookStep.steps.forEach(childStep => {
          expect(childStep.category).to.equal('user');
          expect(childStep.title).to.match(/I expect/);
        });
      });
    });

    it('should maintain correct execution order for hooks', async () => {
      const { testEntries } = await runCodeceptTest('hooks_with_steps_test.js');
      
      // Get the test data
      let testData;
      if (testEntries[0].action === 'addTestsBatch') {
        testData = testEntries[0].tests[0];
      } else {
        testData = testEntries[0].testId;
      }
      
      const allSteps = testData.steps;
      
      // Find indices of hooks and test steps
      const beforeSuiteIndex = allSteps.findIndex(step => step.title === 'BeforeSuite');
      const beforeIndex = allSteps.findIndex(step => step.title === 'Before');
      const afterIndex = allSteps.findIndex(step => step.title === 'After');
      const firstTestStepIndex = allSteps.findIndex(step => step.category === 'user' && !step.steps);
      
      // Verify execution order
      expect(beforeSuiteIndex).to.be.lessThan(beforeIndex, 'BeforeSuite should come before Before');
      expect(beforeIndex).to.be.lessThan(firstTestStepIndex, 'Before should come before test steps');
      expect(firstTestStepIndex).to.be.lessThan(afterIndex, 'Test steps should come before After');
    });
  });

  describe('Section and Hook Integration', () => {
    it('should handle both hooks and sections in the same test', async () => {
      const { testEntries } = await runCodeceptTest('hooks_and_sections_test.js');
      
      // Get the test data
      let testData;
      if (testEntries[0].action === 'addTestsBatch') {
        testData = testEntries[0].tests[0];
      } else {
        testData = testEntries[0].testId;
      }
      
      const allSteps = testData.steps;
      
      // Should have both hook and user sections
      const hookSteps = allSteps.filter(step => step.category === 'hook');
      const sectionSteps = allSteps.filter(step => step.category === 'user' && step.steps);
      const testSteps = allSteps.filter(step => step.category === 'user' && !step.steps);
      
      expect(hookSteps.length).to.be.greaterThan(0);
      expect(sectionSteps.length).to.be.greaterThan(0);
      expect(testSteps.length).to.be.greaterThan(0);
      
      // Check specific sections
      const dataPrepSection = sectionSteps.find(step => step.title === 'Data Preparation');
      const processingSection = sectionSteps.find(step => step.title === 'Processing');
      
      expect(dataPrepSection).to.exist;
      expect(processingSection).to.exist;
    });

    it('should maintain proper nesting structure for mixed content', async () => {
      const { testEntries } = await runCodeceptTest('hooks_and_sections_test.js');
      
      // Get the test data
      let testData;
      if (testEntries[0].action === 'addTestsBatch') {
        testData = testEntries[0].tests[0];
      } else {
        testData = testEntries[0].testId;
      }
      
      // Verify structure integrity
      testData.steps.forEach(step => {
        expect(step).to.have.property('category');
        expect(step).to.have.property('title');
        expect(step).to.have.property('duration');
        
        if (step.steps) {
          expect(step.steps).to.be.an('array');
          step.steps.forEach(childStep => {
            expect(childStep).to.have.property('category');
            expect(childStep).to.have.property('title');
            expect(childStep).to.have.property('duration');
          });
        }
      });
    });
  });

  describe('Step Hierarchy Validation', () => {
    it('should properly format step titles with arguments', async () => {
      const { testEntries } = await runCodeceptTest('hooks_with_steps_test.js');
      
      // Get the test data
      let testData;
      if (testEntries[0].action === 'addTestsBatch') {
        testData = testEntries[0].tests[0];
      } else {
        testData = testEntries[0].testId;
      }
      
      // Find hook with steps that have arguments
      const beforeSuiteHook = testData.steps.find(step => step.title === 'BeforeSuite');
      expect(beforeSuiteHook).to.exist;
      expect(beforeSuiteHook.steps.length).to.be.greaterThan(0);
      
      const stepWithArgs = beforeSuiteHook.steps.find(step => step.title.includes('expectEqual'));
      expect(stepWithArgs).to.exist;
      
      // Should format arguments properly
      expect(stepWithArgs.title).to.match(/I expectEqual.*1.*1/);
    });

    it('should calculate durations correctly for hooks and sections', async () => {
      const { testEntries } = await runCodeceptTest('hooks_with_steps_test.js');
      
      // Get the test data
      let testData;
      if (testEntries[0].action === 'addTestsBatch') {
        testData = testEntries[0].tests[0];
      } else {
        testData = testEntries[0].testId;
      }
      
      const hookSteps = testData.steps.filter(step => step.category === 'hook');
      
      hookSteps.forEach(hook => {
        expect(hook.duration).to.be.a('number');
        expect(hook.duration).to.be.at.least(0);
        
        // Hook duration should be sum of child steps
        if (hook.steps && hook.steps.length > 0) {
          const childrenDuration = hook.steps.reduce((sum, child) => sum + (child.duration || 0), 0);
          expect(hook.duration).to.equal(childrenDuration);
        }
      });
    });

    it('should handle empty hooks gracefully', async () => {
      const { testEntries } = await runCodeceptTest('hooks_test.js');
      
      // Get the test data
      let testData;
      if (testEntries[0].action === 'addTestsBatch') {
        testData = testEntries[0].tests[0];
      } else {
        testData = testEntries[0].testId;
      }
      
      // Original hooks_test.js might not have steps in hooks, should still work
      const allSteps = testData.steps || [];
      
      // Should have test steps even if hooks don't have steps
      const testSteps = allSteps.filter(step => step.category === 'user' && !step.steps);
      expect(testSteps.length).to.be.greaterThan(0);
    });
  });

  describe('Error Handling in Hooks', () => {
    it('should handle failing hooks gracefully', async () => {
      const { testEntries } = await runCodeceptTest('failing_hooks_test.js');
      
      expect(testEntries.length).to.be.greaterThan(0);
      
      // Should capture test data regardless of hook failures
      const allTests = [];
      testEntries.forEach(entry => {
        if (entry.action === 'addTestsBatch') {
          allTests.push(...entry.tests);
        } else if (entry.testId) {
          allTests.push(entry.testId);
        }
      });
      
      expect(allTests.length).to.be.greaterThan(0);
      
      // Verify that tests have proper structure even with hook issues
      allTests.forEach(test => {
        expect(test).to.have.property('title');
        expect(test).to.have.property('status');
        expect(test.status).to.be.oneOf(['passed', 'failed', 'skipped']);
      });
    });

    it('should preserve step structure when hooks fail', async () => {
      const { testEntries } = await runCodeceptTest('failing_hooks_test.js');
      
      testEntries.forEach(entry => {
        const testData = entry.action === 'addTestsBatch' ? entry.tests[0] : entry.testId;
        
        if (testData.steps) {
          testData.steps.forEach(step => {
            expect(step).to.have.property('category');
            expect(step).to.have.property('title');
            expect(step).to.have.property('duration');
          });
        }
      });
    });
  });

  describe('Comprehensive Integration', () => {
    it('should handle all test scenarios with proper step hierarchy', async () => {
      const { testEntries } = await runCodeceptTest('steps_sections_test.js');
      
      expect(testEntries.length).to.be.greaterThan(0);
      
      testEntries.forEach(entry => {
        const testData = entry.action === 'addTestsBatch' ? entry.tests[0] : entry.testId;
        
        if (testData.steps && testData.steps.length > 0) {
          // Verify step structure
          testData.steps.forEach(step => {
            expect(step.category).to.be.oneOf(['user', 'hook', 'framework']);
            expect(step.title).to.be.a('string');
            expect(step.duration).to.be.a('number');
            
            if (step.steps) {
              expect(step.steps).to.be.an('array');
              step.steps.forEach(childStep => {
                expect(childStep.category).to.be.oneOf(['user', 'hook', 'framework']);
                expect(childStep.title).to.be.a('string');
                expect(childStep.duration).to.be.a('number');
              });
            }
          });
        }
      });
    });

    it('should maintain consistency across different test types', async () => {
      // Test multiple files to ensure consistency
      const testFiles = [
        'hooks_with_steps_test.js',
        'hooks_and_sections_test.js',
        'steps_sections_test.js'
      ];
      
      for (const testFile of testFiles) {
        const { testEntries } = await runCodeceptTest(testFile);
        
        expect(testEntries.length).to.be.greaterThan(0);
        
        testEntries.forEach(entry => {
          const testData = entry.action === 'addTestsBatch' ? entry.tests[0] : entry.testId;
          
          // Basic structure validation
          expect(testData).to.have.property('status');
          expect(testData).to.have.property('title');
          expect(testData).to.have.property('run_time');
          
          // Steps structure validation (if present)
          if (testData.steps) {
            expect(testData.steps).to.be.an('array');
            
            testData.steps.forEach(step => {
              expect(step).to.have.property('category');
              expect(step).to.have.property('title');
              expect(step).to.have.property('duration');
            });
          }
        });
      }
    });
  });
});