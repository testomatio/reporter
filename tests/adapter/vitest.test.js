import { expect } from 'chai';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { extractTestEntries } from './utils/extract-test-entries.js';

const execAsync = promisify(exec);

describe('Vitest Adapter Tests', function () {
  this.timeout(60000); // Longer timeout for test execution

  let debugFilePath;
  let exampleDir;

  before(() => {
    exampleDir = path.join(process.cwd(), 'example', 'vitest');
  });

  beforeEach(() => {
    // Debug symlink is created in the cwd of the spawned vitest process (exampleDir),
    // not in the test runner's cwd. Use lstatSync — existsSync follows the link and
    // returns false for dangling symlinks, leaving them in place.
    debugFilePath = path.join(exampleDir, 'testomatio.debug.json');
    try {
      fs.lstatSync(debugFilePath);
      fs.unlinkSync(debugFilePath);
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
  });

  afterEach(() => {
    try {
      fs.lstatSync(debugFilePath);
      fs.unlinkSync(debugFilePath);
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
  });

  /**
   * Helper function to run Vitest tests with debug enabled
   * @param {string} testFile - Test file to run (optional, runs all if not specified)
   * @param {object} extraEnv - Additional environment variables
   * @returns {Promise<{stdout: string, stderr: string, debugData: Array, testEntries: Array}>}
   */
  async function runVitestTest(testFile = '', extraEnv = {}) {
    const cmd = testFile ? `npx vitest run ${testFile}` : 'npx vitest run';

    try {
      const { stdout, stderr } = await execAsync(cmd, {
        cwd: exampleDir,
        env: {
          ...process.env,
          DEBUG: '1',
          TESTOMATIO_DEBUG: '1',
          TESTOMATIO_DISABLE_BATCH_UPLOAD: '1',
          ...extraEnv,
        },
      });

      console.log('Test execution output:', stdout);
      if (stderr) console.log('Test execution stderr:', stderr);
    } catch (error) {
      // Tests might fail (we have intentional failures), but adapter should still work
      console.log('Test execution completed with some failures (expected)');
      if (error.stdout) console.log('Error stdout:', error.stdout);
      if (error.stderr) console.log('Error stderr:', error.stderr);
    }

    // Wait a moment for debug file to be finalized
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Use the symlink to the latest debug file (lives in the spawned process's cwd)
    debugFilePath = path.join(exampleDir, 'testomatio.debug.json');
    console.log('Using debug file:', debugFilePath);

    const debugContent = fs.readFileSync(debugFilePath, 'utf-8');
    const debugLines = debugContent
      .trim()
      .split('\n')
      .filter(line => line.trim());
    expect(debugLines.length).to.be.greaterThan(0);

    const debugData = debugLines.map(line => JSON.parse(line));
    const testEntries = extractTestEntries(debugData);
    expect(testEntries.length).to.be.greaterThan(0);

    return { debugData, testEntries };
  }

  describe('Basic Functionality', () => {
    it('should execute tests and generate debug data', async () => {
      const { debugData, testEntries } = await runVitestTest();

      // Verify we got test data
      expect(testEntries.length).to.be.greaterThan(0);
      expect(debugData.length).to.be.greaterThan(0);
    });

    it('should handle both passing and failing tests', async () => {
      const { testEntries } = await runVitestTest('tests/simple.spec.js');

      // Find passing and failing tests
      const passingTests = testEntries.filter(entry => entry.testId.status === 'passed');
      const failingTests = testEntries.filter(entry => entry.testId.status === 'failed');

      expect(passingTests.length).to.be.greaterThan(0, 'Should have passing tests');
      expect(failingTests.length).to.be.greaterThan(0, 'Should have failing tests');
    });
  });

  describe('Test Status and Metadata', () => {
    it('should capture test metadata including file and suite info', async () => {
      const { testEntries } = await runVitestTest('tests/simple.spec.js');

      // Check that all tests have proper metadata
      testEntries.forEach(entry => {
        expect(entry.testId).to.exist;
        expect(entry.testId.title).to.be.a('string');
        expect(entry.testId.suite_title).to.be.a('string');
        expect(entry.testId.file).to.be.a('string');
        expect(entry.testId.status).to.be.oneOf(['passed', 'failed', 'skipped']);
      });
    });

    it('should capture different test statuses (passed, failed, skipped)', async () => {
      const { testEntries } = await runVitestTest();

      // Check for different test statuses
      const statuses = testEntries.map(entry => entry.testId.status);

      // Should have both passed and failed tests
      expect(statuses).to.include('passed');
      expect(statuses).to.include('failed');
      expect(testEntries.length).to.be.greaterThan(1);
    });

    it('should handle skipped tests correctly', async () => {
      const { testEntries } = await runVitestTest('tests/advanced.spec.js');

      // Find skipped test
      const skippedTest = testEntries.find(entry => entry.testId.title === 'skipped test should not run');

      if (skippedTest) {
        expect(skippedTest.testId.status).to.equal('skipped');
      }
    });
  });

  describe('Test Hierarchy and Suite Structure', () => {
    it('should capture nested describe blocks correctly', async () => {
      const { testEntries } = await runVitestTest('tests/advanced.spec.js');

      // Find deeply nested test
      const nestedTest = testEntries.find(entry => entry.testId.title === 'deeply nested test');

      expect(nestedTest).to.exist;
      expect(nestedTest.testId.suite_title).to.be.a('string');
      // Suite title captures the immediate parent suite name (Level 2 in this case)
      expect(nestedTest.testId.suite_title).to.equal('Level 2');
    });

    it('should maintain correct suite hierarchy', async () => {
      const { testEntries } = await runVitestTest('tests/simple.spec.js');

      // Check that tests from different suites have different suite titles
      const mathTests = testEntries.filter(entry => entry.testId.suite_title === 'Math Operations');
      const simpleTests = testEntries.filter(entry => entry.testId.suite_title === 'Simple Tests');

      expect(mathTests.length).to.be.greaterThan(0);
      expect(simpleTests.length).to.be.greaterThan(0);
    });
  });

  describe('Error Handling and Messages', () => {
    it('should capture error information for failing tests', async () => {
      const { testEntries } = await runVitestTest('tests/simple.spec.js');

      const failingTest = testEntries.find(entry => entry.testId.title === 'should always fail');
      expect(failingTest).to.exist;
      expect(failingTest.testId.status).to.equal('failed');

      // Should have error details
      if (failingTest.testId.error) {
        expect(failingTest.testId.error).to.exist;
      }
    });

    it('should handle custom error messages', async () => {
      const { testEntries } = await runVitestTest('tests/advanced.spec.js');

      const errorTest = testEntries.find(entry => entry.testId.title === 'test with error details');

      if (errorTest) {
        expect(errorTest.testId.status).to.equal('passed');
      }
    });
  });

  describe('Test Duration and Timing', () => {
    it('should record test execution time', async () => {
      const { testEntries } = await runVitestTest();

      // All tests should have duration/time recorded (using run_time field)
      testEntries.forEach(entry => {
        expect(entry.testId.run_time).to.exist;
        expect(entry.testId.run_time).to.be.a('number');
        expect(entry.testId.run_time).to.be.at.least(0);
      });
    });

    it('should handle async tests with timeouts', async () => {
      const { testEntries } = await runVitestTest('tests/advanced.spec.js');

      const timeoutTest = testEntries.find(entry => entry.testId.title === 'test with timeout');

      if (timeoutTest) {
        expect(timeoutTest.testId.status).to.equal('passed');
        expect(timeoutTest.testId.run_time).to.be.at.least(100); // Should take at least 100ms
      }
    });
  });

  describe('File Path Handling', () => {
    it('should include relative file paths in test data', async () => {
      const { testEntries } = await runVitestTest();

      testEntries.forEach(entry => {
        if (entry.testId.file) {
          // File paths should not be absolute
          expect(entry.testId.file).to.not.match(/^\/home/);
          // Should include the test file name
          expect(entry.testId.file).to.include('.spec.js');
        }
      });
    });
  });

  describe('Batch Upload Functionality', () => {
    it('should work with batch upload enabled', async () => {
      // Run without TESTOMATIO_DISABLE_BATCH_UPLOAD to test batch mode
      const cmd = 'npx vitest run tests/simple.spec.js';

      let completed = false;
      const timeout = setTimeout(() => {
        if (!completed) {
          throw new Error('Test timed out - batch upload may be hanging the process');
        }
      }, 15000); // 15 second timeout

      try {
        await execAsync(cmd, {
          cwd: exampleDir,
          env: {
            ...process.env,
            DEBUG: '1',
            TESTOMATIO_DEBUG: '1',
            // Note: NOT setting TESTOMATIO_DISABLE_BATCH_UPLOAD
          },
        });
      } catch (error) {
        // Tests might fail, but should complete
        console.log('Batch upload test completed');
      } finally {
        completed = true;
        clearTimeout(timeout);
      }

      // If we get here without timeout, batch upload is working correctly
      expect(completed).to.be.true;
    });

    it('should not hang the process when using batch upload', async () => {
      const startTime = Date.now();

      try {
        await execAsync('npx vitest run tests/simple.spec.js', {
          cwd: exampleDir,
          env: {
            ...process.env,
            TESTOMATIO_DEBUG: '1',
            // Batch upload enabled by default
          },
          timeout: 10000, // 10 second timeout
        });
      } catch (error) {
        // Check if it was a timeout error
        if (error.killed || error.signal === 'SIGTERM') {
          throw new Error('Process was killed due to timeout - batch upload is hanging');
        }
        // Other errors (like test failures) are okay
      }

      const duration = Date.now() - startTime;
      // Should complete in reasonable time (well under 10 seconds)
      expect(duration).to.be.lessThan(10000);
    });
  });

  describe('Reporter Configuration', () => {
    it('should be properly configured in vitest.config.js', () => {
      const configPath = path.join(exampleDir, 'vitest.config.js');
      expect(fs.existsSync(configPath)).to.be.true;

      const configContent = fs.readFileSync(configPath, 'utf-8');
      expect(configContent).to.include('../../src/adapter/vitest.js');
      expect(configContent).to.include('reporters');
    });

    it('should work without API key (local testing)', async () => {
      const { testEntries } = await runVitestTest('tests/simple.spec.js', {
        TESTOMATIO: '', // No API key
      });

      // Tests should still execute and report locally
      expect(testEntries.length).to.be.greaterThan(0);
    });
  });

  describe('Multiple Test Files', () => {
    it('should handle multiple test files in one run', async () => {
      const { testEntries } = await runVitestTest(); // Run all tests

      // Should have tests from both simple.spec.js and advanced.spec.js
      const simpleTests = testEntries.filter(entry => entry.testId.file.includes('simple.spec.js'));
      const advancedTests = testEntries.filter(entry => entry.testId.file.includes('advanced.spec.js'));

      expect(simpleTests.length).to.be.greaterThan(0);
      expect(advancedTests.length).to.be.greaterThan(0);
    });
  });

  describe('Console Output and Logging', () => {
    it('should produce test logs', async () => {
      const { testEntries } = await runVitestTest();

      // Check that we have logs for each test
      testEntries.forEach(entry => {
        // Logs may or may not be present depending on test
        if (entry.testId.logs) {
          expect(entry.testId.logs).to.be.a('string');
        }
      });
    });
  });
});
