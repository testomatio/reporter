import { expect } from 'chai';
import { runTests } from '../adapter/utils/codecept.js';

describe('CodeceptJS BeforeSuite Failure Tests', function () {
  this.timeout(60000);

  it('should mark all tests as failed when BeforeSuite fails', async () => {
    const { debugData } = await runTests('beforesuite_failure_test.js');

    // Find all test entries
    const testEntries = debugData.filter(entry => entry.action === 'addTest' && entry.testId && entry.testId.title);

    // Should have 3 tests
    expect(testEntries).to.have.lengthOf(3);

    const testTitles = testEntries.map(entry => entry.testId.title);
    expect(testTitles).to.include.members([
      'test teams can be created',
      'test teams can be updated',
      'test teams can be deleted',
    ]);

    // All tests should have failed status
    for (const entry of testEntries) {
      expect(entry.testId.status).to.equal('failed');
    }
  });

  it('should report BeforeSuite failure in test results', async () => {
    const { debugData } = await runTests('beforesuite_failure_test.js');

    // Find any failed test (they should all have the BeforeSuite error)
    const failedTest = debugData.find(
      entry => entry.action === 'addTest' && entry.testId && entry.testId.status === 'failed',
    );

    expect(failedTest).to.exist;

    // Should have error message from BeforeSuite
    expect(failedTest.testId.message).to.include('Fails in before suite');
  });

  it('should show correct test counts in stdout', async () => {
    const { stdout } = await runTests('beforesuite_failure_test.js');

    // CodeceptJS shows this format for BeforeSuite failures
    expect(stdout).to.include('0 passed');
    expect(stdout).to.include('1 failed');
    expect(stdout).to.include('1 failedHooks');
    expect(stdout).to.include('2 skipped');
  });
});
