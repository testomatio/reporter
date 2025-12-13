import fs from 'fs';
import path from 'path';
import os from 'os';
import TestomatClient from './client.js';
import { STATUS } from './constants.js';
import { config } from './config.js';

export class Replay {
  constructor(options = {}) {
    this.apiKey = options.apiKey || config.TESTOMATIO || undefined;
    this.dryRun = options.dryRun || false;
    this.onProgress = options.onProgress || (() => {});
    this.onLog = options.onLog || console.log;
    this.onError = options.onError || console.error;
  }

  /**
   * Get the default debug file path
   * @returns {string} Path to the latest debug file
   */
  getDefaultDebugFile() {
    return path.join(os.tmpdir(), 'testomatio.debug.latest.json');
  }

  /**
   * Merge unique files from two arrays, avoiding duplicates
   * @param {Array} existingFiles - Existing files array
   * @param {Array} newFiles - New files to merge
   * @returns {Array} Merged array without duplicates
   */
  mergeUniqueFiles(existingFiles, newFiles) {
    if (!existingFiles || existingFiles.length === 0) return newFiles || [];
    if (!newFiles || newFiles.length === 0) return existingFiles;

    const unique = newFiles.filter(f => !existingFiles.includes(f));
    return [...existingFiles, ...unique];
  }

  /**
   * Merge unique artifacts from two arrays, avoiding duplicates based on path
   * @param {Array} existingArtifacts - Existing artifacts array
   * @param {Array} newArtifacts - New artifacts to merge
   * @returns {Array} Merged array without duplicates
   */
  mergeUniqueArtifacts(existingArtifacts, newArtifacts) {
    if (!existingArtifacts || existingArtifacts.length === 0) return newArtifacts || [];
    if (!newArtifacts || newArtifacts.length === 0) return existingArtifacts;

    const existingPaths = existingArtifacts.map(a => (typeof a === 'string' ? a : a.path));
    const unique = newArtifacts.filter(a => {
      const path = typeof a === 'string' ? a : a.path;
      return !existingPaths.includes(path);
    });
    return [...existingArtifacts, ...unique];
  }

  /**
   * Update test status, prioritizing passed status
   * @param {Object} mergedTest - Test object to update
   * @param {string} newStatus - New status to potentially apply
   */
  updateTestStatus(mergedTest, newStatus) {
    if (newStatus === 'passed') {
      mergedTest.status = 'passed';
    } else if (!mergedTest.status || mergedTest.status !== 'passed') {
      mergedTest.status = newStatus;
    }
  }

  /**
   * Parse a debug file and extract test data
   * @param {string} debugFile - Path to the debug file
   * @returns {Object} Parsed debug data
   */
  parseDebugFile(debugFile) {
    if (!fs.existsSync(debugFile)) {
      throw new Error(`Debug file not found: ${debugFile}`);
    }

    const fileContent = fs.readFileSync(debugFile, 'utf-8');
    const lines = fileContent
      .trim()
      .split('\n')
      .filter(line => line.trim() !== '');

    if (lines.length === 0) {
      throw new Error('Debug file is empty');
    }

    let runParams = {};
    let finishParams = {};
    let parseErrors = 0;
    const testsMap = new Map(); // Use Map to deduplicate by rid
    const testsWithoutRid = []; // For tests without rid (backward compatibility)
    const testRetries = new Map(); // Track retry attempts by rid
    const envVars = {};
    let runId = null;

    // Parse debug file line by line
    for (const [lineIndex, line] of lines.entries()) {
      try {
        const logEntry = JSON.parse(line);

        if (logEntry.data === 'variables' && logEntry.testomatioEnvVars) {
          Object.assign(envVars, logEntry.testomatioEnvVars);
        } else if (logEntry.action === 'createRun') {
          runParams = logEntry.params || {};
        } else if (logEntry.action === 'addTestsBatch' && logEntry.tests) {
          // Extract runId if available
          if (logEntry.runId && !runId) {
            runId = logEntry.runId;
          }
          // Process each test in the batch
          for (const test of logEntry.tests) {
            if (test.rid) {
              // Handle tests with rid (deduplicate)
              const existingTest = testsMap.get(test.rid);
              if (existingTest) {
                // Track retry attempts
                const retryCount = testRetries.get(test.rid) || 0;
                testRetries.set(test.rid, retryCount + 1);

                // Merge test data - prioritize non-null/non-empty values
                const mergedTest = { ...existingTest };
                Object.keys(test).forEach(key => {
                  if (test[key] !== null && test[key] !== undefined) {
                    if (key === 'files' && Array.isArray(test[key]) && test[key].length > 0) {
                      mergedTest.files = this.mergeUniqueFiles(existingTest.files, test[key]);
                    } else if (key === 'artifacts' && Array.isArray(test[key]) && test[key].length > 0) {
                      mergedTest.artifacts = this.mergeUniqueArtifacts(existingTest.artifacts, test[key]);
                    } else if (key === 'status') {
                      this.updateTestStatus(mergedTest, test[key]);
                    } else if (
                      existingTest[key] === null ||
                      existingTest[key] === undefined ||
                      (Array.isArray(existingTest[key]) && existingTest[key].length === 0)
                    ) {
                      // Use new value if existing is null/undefined/empty array
                      mergedTest[key] = test[key];
                    }
                  }
                });
                testsMap.set(test.rid, mergedTest);
              } else {
                testsMap.set(test.rid, { ...test });
              }
            } else {
              // Handle tests without rid (no deduplication)
              testsWithoutRid.push({ ...test });
            }
          }
        } else if (logEntry.action === 'addTest' && logEntry.testId) {
          // Extract runId if available
          if (logEntry.runId && !runId) {
            runId = logEntry.runId;
          }
          const test = logEntry.testId;
          if (test.rid) {
            // Handle tests with rid (deduplicate)
            const existingTest = testsMap.get(test.rid);
            if (existingTest) {
              // Track retry attempts
              const retryCount = testRetries.get(test.rid) || 0;
              testRetries.set(test.rid, retryCount + 1);

              // Merge with existing test
              const mergedTest = { ...existingTest, ...test };
              // Preserve merged arrays
              if (existingTest.files || test.files) {
                mergedTest.files = this.mergeUniqueFiles(existingTest.files, test.files);
              }
              if (existingTest.artifacts || test.artifacts) {
                mergedTest.artifacts = this.mergeUniqueArtifacts(existingTest.artifacts, test.artifacts);
              }
              // Update status with passed priority
              this.updateTestStatus(mergedTest, test.status);
              testsMap.set(test.rid, mergedTest);
            } else {
              testsMap.set(test.rid, { ...test });
            }
          } else {
            // Handle tests without rid (no deduplication)
            testsWithoutRid.push({ ...test });
          }
        } else if (logEntry.actions === 'finishRun') {
          finishParams = logEntry.params || {};
        }
      } catch (err) {
        parseErrors++;
        if (parseErrors <= 3) {
          // Only show first 3 parse errors
          this.onError(`Failed to parse line ${lineIndex + 1}: ${line.substring(0, 100)}...`);
        }
      }
    }

    if (parseErrors > 3) {
      this.onError(`${parseErrors - 3} more parse errors occurred`);
    }

    // Combine tests with rid and tests without rid
    const allTests = [...Array.from(testsMap.values()), ...testsWithoutRid];

    // Add retry information to tests
    for (const test of allTests) {
      if (test.rid && testRetries.has(test.rid)) {
        const retryCount = testRetries.get(test.rid);
        if (retryCount > 0) {
          test.retryAttempts = retryCount;
        }
      }
    }

    return {
      runParams,
      finishParams,
      tests: allTests,
      envVars,
      parseErrors,
      totalLines: lines.length,
      runId,
      totalRetries: Array.from(testRetries.values()).reduce((sum, count) => sum + count, 0),
    };
  }

  /**
   * Filter artifacts to only include files that exist on the file system
   * @param {Array} artifacts - Array of artifact objects or paths
   * @returns {Array} Filtered artifacts array
   */
  filterExistingArtifacts(artifacts) {
    if (!artifacts || !Array.isArray(artifacts) || artifacts.length === 0) {
      return [];
    }

    return artifacts.filter(artifact => {
      const filePath = typeof artifact === 'string' ? artifact : artifact.path;
      if (!filePath) return false;

      try {
        return fs.existsSync(filePath);
      } catch (err) {
        return false;
      }
    });
  }

  /**
   * Filter files to only include those that exist on the file system
   * @param {Array} files - Array of file paths
   * @returns {Array} Filtered files array
   */
  filterExistingFiles(files) {
    if (!files || !Array.isArray(files) || files.length === 0) {
      return [];
    }

    return files.filter(filePath => {
      if (!filePath) return false;

      try {
        return fs.existsSync(filePath);
      } catch (err) {
        return false;
      }
    });
  }

  /**
   * Restore environment variables from debug data
   * @param {Object} envVars - Environment variables to restore
   */
  restoreEnvironmentVariables(envVars) {
    // Only restore env vars that aren't already set (don't override current values)
    Object.keys(envVars).forEach(key => {
      if (process.env[key] === undefined || process.env[key] === '') {
        process.env[key] = envVars[key];
      }
    });
  }

  /**
   * Replay test data to Testomat.io
   * @param {string} debugFile - Path to debug file (optional, uses default if not provided)
   * @returns {Promise<Object>} Replay results
   */
  async replay(debugFile) {
    if (!debugFile) {
      debugFile = this.getDefaultDebugFile();
    }

    if (!this.apiKey) {
      throw new Error('TESTOMATIO API key not found. Set TESTOMATIO environment variable.');
    }

    this.onLog(`Replaying data from debug file: ${debugFile}`);

    // Parse the debug file
    const debugData = this.parseDebugFile(debugFile);
    const { runParams, finishParams, tests, envVars, runId, totalRetries } = debugData;

    this.onLog(`Found ${tests.length} tests to replay`);
    if (totalRetries > 0) {
      this.onLog(`Detected ${totalRetries} retry attempts across tests`);
    }

    if (tests.length === 0) {
      throw new Error('No test data found in debug file');
    }

    // Filter artifacts and files that don't exist
    let totalArtifacts = 0;
    let missingArtifacts = 0;
    let totalFiles = 0;
    let missingFiles = 0;

    for (const test of tests) {
      if (test.artifacts) {
        const originalCount = test.artifacts.length;
        totalArtifacts += originalCount;
        test.artifacts = this.filterExistingArtifacts(test.artifacts);
        missingArtifacts += originalCount - test.artifacts.length;
      }

      if (test.files) {
        const originalCount = test.files.length;
        totalFiles += originalCount;
        test.files = this.filterExistingFiles(test.files);
        missingFiles += originalCount - test.files.length;
      }
    }

    if (totalArtifacts > 0) {
      const available = totalArtifacts - missingArtifacts;
      this.onLog(`Found ${totalArtifacts} artifacts (${available} available, ${missingArtifacts} missing)`);
    }
    if (totalFiles > 0) {
      const available = totalFiles - missingFiles;
      this.onLog(`Found ${totalFiles} files (${available} available, ${missingFiles} missing)`);
    }
    if (missingArtifacts > 0 || missingFiles > 0) {
      this.onLog('⚠️  Missing artifacts/files will be skipped during upload');
    }

    // Restore environment variables
    this.restoreEnvironmentVariables(envVars);

    if (this.dryRun) {
      return {
        success: true,
        testsCount: tests.length,
        runParams,
        finishParams,
        envVars,
        runId,
        dryRun: true,
        totalRetries,
        totalArtifacts,
        missingArtifacts,
        availableArtifacts: totalArtifacts - missingArtifacts,
        totalFiles,
        missingFiles,
        availableFiles: totalFiles - missingFiles,
      };
    }

    // Create client and restore the run
    const client = new TestomatClient({
      apiKey: this.apiKey,
      isBatchEnabled: true,
      ...runParams,
    });

    // Use the stored runId if available, otherwise create a new run
    if (runId) {
      this.onLog(`Using existing run ID: ${runId}`);
      client.runId = runId;
    } else {
      this.onLog('Publishing to run...');
      await client.createRun(runParams);
    }

    // Send each test result
    let successCount = 0;
    let failureCount = 0;

    for (const [index, test] of tests.entries()) {
      try {
        await client.addTestRun(test.status, { ...test, overwrite: true });
        successCount++;
        this.onProgress({
          current: index + 1,
          total: tests.length,
          test,
          success: true,
        });
      } catch (err) {
        failureCount++;
        this.onError(`Failed to send test ${index + 1}: ${err.message}`);
        this.onProgress({
          current: index + 1,
          total: tests.length,
          test,
          success: false,
          error: err.message,
        });
      }
    }

    await client.updateRunStatus(finishParams.status || STATUS.FINISHED);

    const result = {
      success: true,
      testsCount: tests.length,
      successCount,
      failureCount,
      runParams,
      finishParams,
      envVars,
      runId: runId || client.runId,
      totalRetries,
      totalArtifacts,
      missingArtifacts,
      availableArtifacts: totalArtifacts - missingArtifacts,
      totalFiles,
      missingFiles,
      availableFiles: totalFiles - missingFiles,
    };

    this.onLog(`Successfully replayed ${successCount}/${tests.length} tests from debug file`);
    if (totalRetries > 0) {
      this.onLog(`Processed ${totalRetries} test retries`);
    }
    if (totalArtifacts - missingArtifacts > 0) {
      this.onLog(`Uploaded ${totalArtifacts - missingArtifacts} artifacts`);
    }

    return result;
  }
}

export default Replay;
