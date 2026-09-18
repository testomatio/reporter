import { expect } from 'chai';
import { runTests } from '../adapter/utils/codecept.js';

describe('CodeceptJS BeforeSuite Failure Tests', function () {
  this.timeout(60000);

  it('should fail the current test and skip the remaining tests when BeforeSuite fails', async () => {
    const { testEntries } = await runTests('beforesuite_failure_test.js');

    // Should have 3 tests
    expect(testEntries).to.have.lengthOf(3);

    const testTitles = testEntries.map(entry => entry.testId.title);
    expect(testTitles).to.include.members([
      'test teams can be created',
      'test teams can be updated',
      'test teams can be deleted',
    ]);

    const failedTests = testEntries.filter(entry => entry.testId.status === 'failed');
    const skippedTests = testEntries.filter(entry => entry.testId.status === 'skipped');

    expect(failedTests).to.have.lengthOf(1);
    expect(failedTests[0].testId.title).to.equal('test teams can be created');
    expect(skippedTests).to.have.lengthOf(2);
  });

  it('should report BeforeSuite failure in test results', async () => {
    const { testEntries } = await runTests('beforesuite_failure_test.js');

    const failedTest = testEntries.find(entry => entry.testId.status === 'failed');

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
