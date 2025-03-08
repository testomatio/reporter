import TestomatClient from '../client.js';
import { config } from '../config.js';
import { STATUS } from '../constants';

const apiKey = config.TESTOMATIO;
const client = new TestomatClient({ apiKey, testFramework: 'nightwatch' });

export default {
  write: async function (results, options, done) {
    await client.createRun();

    const testFiles = results.modules;

    for (const fileName in testFiles) {
      // in nightwatch: object containing tests from a single file
      const testModule = testFiles[fileName];

      // passed and failed tests (tests with assertions)
      const completedTests = testModule.completed;

      // skipped tests (skipped by user or tests without assertions)
      const skippedTests = testModule.skipped;

      const tags = testModule.tags || [];

      // if test file contains multiple suites, the last suite name is used as a name 🤷‍♂️
      // no other places which contain suite name (even inside test object)
      const suiteTitle = testModule.name;

      for (const testTitle in completedTests) {
        const test = completedTests[testTitle];
        let status;
        switch (test.status) {
          case 'pass':
            status = STATUS.PASSED;
            break;
          case 'fail':
            status = STATUS.FAILED;
            break;
          // probably not required (because skipped tests are in separate array), but just in case
          case 'skip':
            status = STATUS.SKIPPED;
            console.info('Skipped test is in completed tests array:', test, 'Not expected behavior.');
            break;
          default:
            console.error('Test status processing error:', test.status);
        }

        client.addTestRun(status, {
          error: { name: test.assertions?.[0]?.name, message: test.assertions?.[0]?.message },
          file: testModule.modulePath?.replace(process.cwd(), ''),
          message: test.assertions?.[0]?.message,
          stack: test.stackTrace,
          suite_title: suiteTitle,
          tags,
          test_id: testModule.uuid + test.title,
          time: test.timeMs,
          title: testTitle,
        });
      }

      // just array with skipped tests titles, no any other info
      for (const testTitle of skippedTests) {
        client.addTestRun(STATUS.SKIPPED, {
          suite_title: suiteTitle,
          tags,
          test_id: testModule.uuid + testTitle,
          title: testTitle,
        });
      }
    }

    const runStatus = results.failed ? 'failed' : results.passed ? 'passed' : 'finished';
    await client.updateRunStatus(runStatus);

    done();
  },
};
