import { expect } from 'chai';
import { runTests } from '../adapter/utils/codecept.js';

describe('CodeceptJS Argument Truncation Tests', function () {
  this.timeout(60000);

  it('should truncate large arguments in steps', async () => {
    const { debugData } = await runTests('steps_sections_test.js', {
      grep: '@truncation',
    });

    // Find the truncation test
    const truncationTest = debugData.find(
      entry =>
        entry.action === 'addTest' &&
        entry.testId &&
        entry.testId.title?.includes('Test truncation of large arguments'),
    );

    expect(truncationTest).to.exist;
    expect(truncationTest.testId.steps).to.exist;

    // Check all steps are under 1K (1000 chars)
    for (const step of truncationTest.testId.steps) {
      expect(step.title.length).to.be.lessThan(1000);
    }

    // Verify we have the expected steps
    const stepTitles = truncationTest.testId.steps.map(s => s.title);
    const hasLargeJsonStep = stepTitles.some(title => title.includes('Processing large JSON'));
    expect(hasLargeJsonStep).to.be.true;
  });

  it('should truncate stack traces', async () => {
    const { debugData } = await runTests('steps_sections_test.js', {
      grep: '@truncation',
    });

    // Find the truncation test
    const truncationTest = debugData.find(
      entry =>
        entry.action === 'addTest' &&
        entry.testId &&
        entry.testId.title?.includes('Test truncation of large arguments'),
    );

    expect(truncationTest).to.exist;

    // Look for failed steps (they should have stack traces)
    let foundStack = false;
    for (const step of truncationTest.testId.steps) {
      if (step.error && step.error.stack) {
        foundStack = true;
        // Stack trace should also be truncated
        expect(step.error.stack.length).to.be.lessThan(2000);
      }
    }

    // Should have found a stack trace from the forced error
    expect(foundStack).to.be.true;
  });

  it('should preserve small arguments without truncation', async () => {
    const { debugData } = await runTests('steps_sections_test.js');

    // Find any test with small arguments
    let foundSmallArg = false;
    for (const entry of debugData) {
      if (entry.action === 'addTest' && entry.testId?.steps) {
        for (const step of entry.testId.steps) {
          if (step.title && step.title.includes('expect equal 1, 1')) {
            foundSmallArg = true;
            // Small argument should be complete and not truncated
            expect(step.title).to.equal('I expect equal 1, 1');
            expect(step.title).to.not.include('...');
            break;
          }
        }
      }
    }

    expect(foundSmallArg).to.be.true;
  });
});
