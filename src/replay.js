import fs from 'fs';
import path from 'path';
import os from 'os';
import TestomatClient from './client.js';
import { STATUS } from './constants.js';
import { config } from './config.js';

const isEnabled = !!process.env.TESTOMATIO_DEBUG || !!process.env.DEBUG;

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
   * Read artifacts file for a specific run
   * @param {string} runId - Run ID to find artifacts for
   * @returns {Array} Array of artifact records with rid and file paths
   */
  readArtifactsFile(runId) {
    if (!runId) return [];

    const artifactsFile = path.join(os.tmpdir(), `testomatio.run.${runId}.json`);

    if (!fs.existsSync(artifactsFile)) {
      if (isEnabled) console.log(`No artifacts file found: ${artifactsFile}`);
      return [];
    }

    try {
      const data = fs.readFileSync(artifactsFile, 'utf-8');
      const lines = data.split('\n').filter(Boolean);
      const artifacts = lines.map(line => JSON.parse(line));
      if (isEnabled) console.log(`Found ${artifacts.length} artifact records in ${artifactsFile}`);
      return artifacts;
    } catch (err) {
      if (isEnabled) console.log(`Error reading artifacts file: ${err.message}`);
      return [];
    }
  }

  /**
   * Merge artifacts data with test data
   * @param {Array} tests - Array of test objects
   * @param {Array} artifacts - Array of artifact records
   * @returns {Array} Tests with merged artifact data
   */
  mergeArtifactsWithTests(tests, artifacts) {
    if (!artifacts.length) return tests;

    // Extract runId prefix from first test
    const runIdPrefix = tests[0]?.rid ? tests[0].rid.split('-')[0] + '-' : '';

    // Group artifacts by RID
    const artifactsByRid = artifacts.reduce((acc, artifact) => {
      const fullRid = runIdPrefix && !artifact.rid.startsWith(runIdPrefix) ? runIdPrefix + artifact.rid : artifact.rid;

      if (!acc[fullRid]) acc[fullRid] = [];
      acc[fullRid].push(artifact);
      return acc;
    }, {});

    // Merge artifacts into tests
    let mergedCount = 0;
    const result = tests.map(test => {
      if (!test.rid || !artifactsByRid[test.rid]) return test;

      const testArtifacts = artifactsByRid[test.rid];
      mergedCount++;

      if (isEnabled && test.title) {
        console.log(`🔄 Adding artifact info for test: ${test.title}`);
        console.log(`  📎 Existing files: ${(test.files || []).length} | Artifact records: ${testArtifacts.length}`);
      }

      // Deduplicate artifacts by filename
      const seenFiles = new Set();
      const deduplicatedArtifacts = testArtifacts.filter(artifact => {
        if (!artifact.file) return true;
        const fileName = path.basename(artifact.file);
        if (seenFiles.has(fileName)) {
          if (isEnabled && test.title) {
            console.log(`  ⚠️  Removed duplicate artifact: ${fileName}`);
          }
          return false;
        }
        seenFiles.add(fileName);
        return true;
      });

      if (isEnabled && test.title && deduplicatedArtifacts.length !== testArtifacts.length) {
        console.log(`  🧹 Deduplicated: ${testArtifacts.length} → ${deduplicatedArtifacts.length} artifacts`);
      }

      return {
        ...test,
        files: test.files || [],
        artifactRecords: deduplicatedArtifacts,
      };
    });

    if (isEnabled) {
      console.log(`🔄 Added artifact info to ${mergedCount} tests (no file duplication)`);
    }

    return result;
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
                // Merge test data - prioritize non-null/non-empty values
                const mergedTest = { ...existingTest };
                Object.keys(test).forEach(key => {
                  if (test[key] !== null && test[key] !== undefined) {
                    if (key === 'files' && Array.isArray(test[key]) && test[key].length > 0) {
                      // Deduplicate files within the array itself
                      const seen = new Set();
                      mergedTest.files = test[key].filter(file => {
                        const fileName =
                          typeof file === 'string'
                            ? path.basename(file)
                            : path.basename(file?.path || file?.file || '');
                        if (seen.has(fileName)) return false;
                        seen.add(fileName);
                        return true;
                      });
                    } else if (key === 'artifacts' && Array.isArray(test[key]) && test[key].length > 0) {
                      // Keep the most recent artifacts array (don't merge to avoid duplicates)
                      mergedTest.artifacts = test[key];
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
              // Merge test data - prioritize non-null/non-empty values (same logic as addTestsBatch)
              const mergedTest = { ...existingTest };
              Object.keys(test).forEach(key => {
                if (test[key] !== null && test[key] !== undefined) {
                  if (key === 'files' && Array.isArray(test[key]) && test[key].length > 0) {
                    // Deduplicate files within the array itself
                    const seen = new Set();
                    mergedTest.files = test[key].filter(file => {
                      const fileName =
                        typeof file === 'string' ? path.basename(file) : path.basename(file?.path || file?.file || '');
                      if (seen.has(fileName)) return false;
                      seen.add(fileName);
                      return true;
                    });
                  } else if (key === 'artifacts' && Array.isArray(test[key]) && test[key].length > 0) {
                    // Keep the most recent artifacts array (don't merge to avoid duplicates)
                    mergedTest.artifacts = test[key];
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

    return {
      runParams,
      finishParams,
      tests: allTests,
      envVars,
      parseErrors,
      totalLines: lines.length,
      runId,
    };
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
    const { runParams, finishParams, envVars, runId } = debugData;
    let tests = debugData.tests;

    this.onLog(`Found ${tests.length} tests to replay`);

    if (tests.length === 0) {
      throw new Error('No test data found in debug file');
    }

    // Read and merge artifacts if runId is available
    if (runId) {
      const artifacts = this.readArtifactsFile(runId);
      if (artifacts.length > 0) {
        if (isEnabled) console.log(`Found ${artifacts.length} artifact records in testomatio.run.${runId}.json`);
        tests = this.mergeArtifactsWithTests(tests, artifacts);
      }
    }

    // Restore environment variables
    this.restoreEnvironmentVariables(envVars);

    if (this.dryRun) {
      if (isEnabled) console.log('🔍 DRY RUN - Tests to be sent:');
      if (isEnabled) console.log('='.repeat(60));

      let totalArtifacts = 0;
      let totalFiles = 0;
      let uploadedArtifacts = 0;
      let notUploadedArtifacts = 0;

      tests.forEach((test, index) => {
        const status = test.status === 'passed' ? '✅' : test.status === 'failed' ? '❌' : '⏭️';
        if (isEnabled) console.log(`${index + 1}. ${status} ${test.title || test.id}`);
        if (isEnabled) console.log(`    📁 File: ${test.file || 'Unknown'}`);
        if (isEnabled) console.log(`    📊 Status: ${test.status}`);
        if (isEnabled) console.log(`    🔑 RID: ${test.rid || 'No RID'}`);

        if (test.steps && test.steps.length > 0) {
          if (isEnabled) console.log(`   🔄 Steps: ${test.steps.length}`);
          test.steps.slice(0, 3).forEach((step, stepIndex) => {
            const stepStatus = step.status === 'passed' ? '✅' : step.status === 'failed' ? '❌' : '⚪';
            if (isEnabled) console.log(`     ${stepIndex + 1}. ${stepStatus} ${step.title || step.name || 'Step'}`);
          });
          if (test.steps.length > 3) {
            if (isEnabled) console.log(`     ... also ${test.steps.length - 3} steps`);
          }
        }

        // Show either artifact records (if available) or files
        if (test.artifactRecords && test.artifactRecords.length > 0) {
          totalArtifacts += test.artifactRecords.length;
          if (isEnabled) console.log(`   📎 Artifacts: ${test.artifactRecords.length}`);
          test.artifactRecords.forEach((artifact, artIndex) => {
            const uploaded =
              artifact.uploaded === true
                ? '✅ Uploaded'
                : artifact.uploaded === false
                  ? '📤 Not Uploaded'
                  : '⏳ Unknown';
            const fileName = artifact.file ? path.basename(artifact.file) : 'Unknown';
            if (isEnabled) console.log(`     ${artIndex + 1}. ${uploaded}: ${fileName}`);

            // Count artifact upload status
            if (artifact.uploaded === true) {
              uploadedArtifacts++;
            } else if (artifact.uploaded === false) {
              notUploadedArtifacts++;
            }
          });
        } else if (test.files && test.files.length > 0) {
          totalFiles += test.files.length;
          if (isEnabled) console.log(`   📎 Files: ${test.files.length}`);
          test.files.slice(0, 3).forEach((file, fileIndex) => {
            // Handle both string paths and object formats
            let fileName;
            if (typeof file === 'string') {
              fileName = path.basename(file);
            } else if (file && typeof file === 'object') {
              const filePath = file.path || file.file || JSON.stringify(file);
              fileName = file.name || (typeof filePath === 'string' ? path.basename(filePath) : 'Unknown');
            } else {
              fileName = 'Unknown';
            }
            if (isEnabled) console.log(`     ${fileIndex + 1}. ${fileName}`);
          });
          if (test.files.length > 3) {
            if (isEnabled) console.log(`     ... also ${test.files.length - 3} files`);
          }
        }

        if (isEnabled) console.log('');
      });

      if (isEnabled) console.log('='.repeat(60));
      if (isEnabled) console.log('📊 SUMMARY:');
      if (isEnabled) console.log(`  📋 Total tests: ${tests.length}`);
      if (isEnabled) console.log(`  📎 Total files: ${totalFiles}`);
      if (isEnabled) console.log(`  📎 Total artifact records: ${totalArtifacts}`);
      if (totalArtifacts > 0) {
        if (isEnabled) console.log(`      ✅ Uploaded: ${uploadedArtifacts}`);
        if (isEnabled) console.log(`      📤 Not Uploaded: ${notUploadedArtifacts}`);
      }
      if (isEnabled) console.log(`  🆔 Run ID: ${runId || 'Will create new'}`);
      if (isEnabled) console.log(`  🌍 Environment: ${envVars.TESTOMATIO_ENV || 'Unknown'}`);
      if (isEnabled) console.log(`  🔗 API URL: ${envVars.TESTOMATIO_URL || 'Default'}`);
      if (isEnabled) console.log('');
      if (isEnabled) console.log('✅ Use without --dry-run to send this data to Testomat.io');
      return {
        success: true,
        testsCount: tests.length,
        runParams,
        finishParams,
        envVars,
        runId,
        dryRun: true,
      };
    }

    // Create client and restore the run
    const client = new TestomatClient({
      apiKey: this.apiKey,
      // isBatchEnabled: true,
      ...runParams,
    });

    if (isEnabled) {
      console.log('🔧 CLIENT CONFIGURATION:');
      console.log(`  🔑 API Key: ${this.apiKey ? `${this.apiKey.slice(0, 10)}...` : 'NOT SET'}`);
      console.log(`  🏪 Batch enabled: ${runParams.isBatchEnabled || 'unknown'}`);
      console.log(`  📡 Pipes count: ${client.pipes ? client.pipes.length : 0}`);
      if (client.pipes && client.pipes.length > 0) {
        client.pipes.forEach((pipe, index) => {
          console.log(`    ${index + 1}. ${pipe.toString()} - enabled: ${pipe.isEnabled}`);
        });
      } else {
        console.log(`  ⚠️  WARNING: No pipes configured!`);
      }
      console.log(`  📤 Uploader enabled: ${client.uploader ? client.uploader.isEnabled : 'unknown'}`);
      console.log('');
    }

    // Use the stored runId if available, otherwise create a new run
    if (runId) {
      this.onLog(`Using existing run ID: ${runId}`);
      if (isEnabled) console.log(`🔄 Restoring run with ID: ${runId}`);
      if (isEnabled) console.log(`📊 Run params:`, JSON.stringify(runParams, null, 2));
      client.runId = runId;
      // Always call createRun to initialize batch system and update run params
      if (isEnabled) console.log(`🔄 Initializing batch system for existing run...`);
      // await client.createRun({ ...runParams, isBatchEnabled: true });
      await client.createRun(runParams);
      this.onLog(`Create new run`);
    } else {
      this.onLog('Publishing to run...');
      if (isEnabled) console.log(`🆕 Creating new run with params:`, JSON.stringify(runParams, null, 2));
      await client.createRun(runParams);
      if (isEnabled) console.log(`✅ New run created with ID: ${client.runId}`);
    }

    if (isEnabled) {
      console.log('🔧 POST-INITIALIZATION STATUS:');
      console.log(`  🆔 Final Run ID: ${client.runId}`);

      // Check each pipe status
      if (!client.pipes?.length) {
        console.log('  ⚠️ No pipes found!');
      } else {
        client.pipes.forEach((pipe, index) => {
          console.log(`  📡 Pipe ${index + 1}: ${pipe.toString()}`);
          console.log(`      ✅ Enabled: ${pipe.isEnabled}`);
          console.log(`      🆔 Run ID: ${pipe.runId || 'NOT SET'}`);

          if (!pipe.toString().includes('Testomatio') || !pipe.batch) return;

          console.log(`      🔄 Batch enabled: ${pipe.batch.isEnabled}`);
          console.log(`      ⏱️  Batch interval: ${pipe.batch.intervalFunction ? 'RUNNING' : 'NOT RUNNING'}`);
          console.log(`      📦 Tests in queue: ${pipe.batch.tests?.length || 0}`);
        });
      }
      console.log('');
    }

    if (isEnabled) {
      console.log('🚀 SENDING TESTS TO TESTOMAT.IO');
      console.log('='.repeat(60));
    }

    // Send each test result
    let successCount = 0;
    let failureCount = 0;

    for (const [index, test] of tests.entries()) {
      try {
        if (isEnabled) {
          const status = test.status === 'passed' ? '✅' : test.status === 'failed' ? '❌' : '⏭️';
          console.log(`\n📤 Sending test ${index + 1}/${tests.length}: ${status} ${test.title || test.id}`);
          console.log(`    📁 File: ${test.file || 'Unknown'}`);
          console.log(`    🔑 RID: ${test.rid || 'No RID'}`);
          console.log(`    📊 Status: ${test.status}${test.steps?.length > 0 ? ` | steps: ${test.steps.length}` : ''}`);

          // Show artifacts info
          if (test.artifactRecords?.length) {
            console.log(`    📎 Artifacts: ${test.artifactRecords.length}`);
            test.artifactRecords.forEach((artifact, i) => {
              const status = artifact.uploaded ? '✅ Uploaded' : '📤 Not Uploaded';
              const name = artifact.file ? path.basename(artifact.file) : 'Unknown';
              console.log(`        ${i + 1}. ${status}: ${name}`);
            });
          } else if (test.files?.length) {
            console.log(`    📎 Files: ${test.files.length}`);
            test.files.slice(0, 3).forEach((file, i) => {
              const name =
                typeof file === 'string' ? path.basename(file) : path.basename(file?.path || file?.file || 'Unknown');
              console.log(`        ${i + 1}. ${name}`);
            });
            if (test.files.length > 3) {
              console.log(`        ... also ${test.files.length - 3} more files`);
            }
          }

          // Show the actual data payload being sent
          const uniqueFiles = test.files
            ? [
                ...new Set(
                  test.files.map(f =>
                    typeof f === 'string' ? path.basename(f) : path.basename(f?.path || f?.file || ''),
                  ),
                ),
              ].length
            : 0;

          console.log(
            `    📦 Payload preview:`,
            JSON.stringify(
              {
                status: test.status,
                title: test.title,
                id: test.id,
                rid: test.rid,
                uniqueFiles,
                steps: test.steps ? test.steps.length : 0,
                artifactRecords: test.artifactRecords ? test.artifactRecords.length : 0,
              },
              null,
              2,
            ),
          );
        }

        const addTestRunResult = await client.addTestRun(test.status, test);
        successCount++;

        this.onProgress({
          current: index + 1,
          total: tests.length,
          test,
          success: true,
        });
      } catch (err) {
        failureCount++;
        if (isEnabled) {
          console.log(`    ❌ Failed to send: ${err.message}`);
          console.log(`    🔍 Error details:`, err);
        }
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

    if (isEnabled) {
      console.log('\n' + '='.repeat(60));
      console.log('🏁 FINISHING RUN');
      console.log(`📊 Finish params:`, JSON.stringify(finishParams, null, 2));
    }

    await client.updateRunStatus(finishParams.status || STATUS.FINISHED, finishParams.parallel || false);

    if (isEnabled) {
      console.log(`✅ Run finished with status: ${finishParams.status || STATUS.FINISHED}`);

      // Wait a bit for batch system to finish sending remaining tests
      const testomatioPipe = client.pipes && client.pipes.find(p => p.toString().includes('Testomatio'));
      if (
        testomatioPipe &&
        testomatioPipe.batch &&
        testomatioPipe.batch.tests &&
        testomatioPipe.batch.tests.length > 0
      ) {
        console.log(`⏳ Waiting for batch system to send ${testomatioPipe.batch.tests.length} remaining tests...`);
        await new Promise(resolve => setTimeout(resolve, 6000)); // Wait 6 seconds for batch upload

        const remainingAfterWait = testomatioPipe.batch.tests ? testomatioPipe.batch.tests.length : 0;
        if (remainingAfterWait > 0) {
          console.log(`⚠️  ${remainingAfterWait} tests still in batch queue after waiting`);
        } else {
          console.log(`✅ All tests successfully sent via batch system`);
        }
      }
    }

    const result = {
      success: true,
      testsCount: tests.length,
      successCount,
      failureCount,
      runParams,
      finishParams,
      envVars,
      runId: runId || client.runId,
    };

    if (isEnabled) {
      console.log('\n' + '='.repeat(60));
      console.log('📊 FINAL SUMMARY:');
      console.log(`  📋 Total tests: ${tests.length}`);
      console.log(`  ✅ Successfully sent: ${successCount}`);
      console.log(`  ❌ Failed to send: ${failureCount}`);
      console.log(`  🆔 Run ID: ${runId || client.runId}`);
      console.log(`  🌍 Environment: ${envVars.TESTOMATIO_ENV || 'Unknown'}`);
      console.log(`  🔗 API URL: ${envVars.TESTOMATIO_URL || 'Default'}`);

      // Check final batch status
      if (client.pipes && client.pipes.length > 0) {
        const testomatioPipe = client.pipes.find(p => p.toString().includes('Testomatio'));
        if (testomatioPipe && testomatioPipe.batch) {
          const remainingTests = testomatioPipe.batch.tests ? testomatioPipe.batch.tests.length : 0;
          console.log(`  🔄 Final batch queue: ${remainingTests} tests remaining`);
          console.log(`  ⏱️  Batch interval: ${testomatioPipe.batch.intervalFunction ? 'STILL RUNNING' : 'STOPPED'}`);
        }
      }

      console.log('='.repeat(60));
    }

    this.onLog(`Successfully replayed ${successCount}/${tests.length} tests from debug file`);

    return result;
  }
}

export default Replay;
