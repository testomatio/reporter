import { expect } from 'chai';
import { exec } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('Playwright Adapter Tests', function () {
  this.timeout(60000); // Longer timeout for test execution

  let debugFilePath;
  let exampleDir;

  before(() => {
    // Use our new example directory
    exampleDir = path.join(process.cwd(), 'example', 'playwright');
  });

  beforeEach(() => {
    // Use the latest symlink path
    debugFilePath = path.join(os.tmpdir(), 'testomatio.debug.latest.json');
    // Clean up any existing debug files before starting
    const symlinkPath = path.join(os.tmpdir(), 'testomatio.debug.latest.json');
    if (fs.existsSync(symlinkPath)) {
      fs.unlinkSync(symlinkPath);
    }
  });

  afterEach(() => {
    // Clean up debug file after each test
    if (fs.existsSync(debugFilePath)) {
      fs.unlinkSync(debugFilePath);
    }
  });

  // Helper function to run Playwright tests with debug enabled
  async function runPlaywrightTest(testFile = 'simple.spec.js', extraEnv = {}) {
    const cmd = `npx playwright test ${testFile}`;

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

    // Find the most recent debug file created during this test
    const tmpFiles = fs.readdirSync(os.tmpdir())
      .filter(f => f.startsWith('testomatio.debug.') && f.endsWith('.json') && !f.includes('latest'))
      .map(f => ({
        name: f,
        path: path.join(os.tmpdir(), f),
        mtime: fs.statSync(path.join(os.tmpdir(), f)).mtime
      }))
      .sort((a, b) => b.mtime - a.mtime);

    console.log('Found debug files:', tmpFiles.map(f => f.name));
    expect(tmpFiles.length).to.be.greaterThan(0, 'No debug files found');
    
    // Use the most recent debug file
    debugFilePath = tmpFiles[0].path;
    console.log('Using debug file:', debugFilePath);
    
    const debugContent = fs.readFileSync(debugFilePath, 'utf-8');
    const debugLines = debugContent
      .trim()
      .split('\n')
      .filter(line => line.trim());
    expect(debugLines.length).to.be.greaterThan(0);

    const debugData = debugLines.map(line => JSON.parse(line));
    const testEntries = debugData.filter(entry => entry.action === 'addTest');
    expect(testEntries.length).to.be.greaterThan(0);

    return { debugData, testEntries };
  }

  describe('Basic Functionality', () => {
    it('should execute tests and generate debug data', async () => {
      const { debugData, testEntries } = await runPlaywrightTest();

      // Verify we got test data
      expect(testEntries.length).to.be.greaterThan(0);
      expect(debugData.length).to.be.greaterThan(0);
    });
  });

  describe('Annotation Metadata', () => {
    it('should extract and include test annotations in metadata', async () => {
      const { testEntries } = await runPlaywrightTest();

      // Find test with status annotation (passing test)
      const testWithStatusAnnotation = testEntries.find(
        entry => entry.testId && entry.testId.meta && entry.testId.meta.status,
      );

      expect(testWithStatusAnnotation).to.exist;
      expect(testWithStatusAnnotation.testId.meta.status).to.equal('reliable');

      // Find test with bug annotation (failing test)
      const testWithBugAnnotation = testEntries.find(
        entry => entry.testId && entry.testId.meta && entry.testId.meta.bug,
      );

      expect(testWithBugAnnotation).to.exist;
      expect(testWithBugAnnotation.testId.meta.bug).to.include('intentional failure');
    });
  });

  describe('Relative File Paths', () => {
    it('should convert absolute paths to relative paths', async () => {
      const { testEntries } = await runPlaywrightTest();

      // Check that file paths are relative (not starting with '/')
      testEntries.forEach(entry => {
        if (entry.testId && entry.testId.file) {
          expect(entry.testId.file).to.not.match(/^\/home/);
          // Normalize path separators for cross-platform compatibility
          const normalizedPath = entry.testId.file.replace(/\\/g, '/');
          expect(normalizedPath).to.include('tests/simple.spec.js');
        }
      });
    });

    it('should respect TESTOMATIO_WORKDIR environment variable', async () => {
      const customWorkdir = path.join(process.cwd(), 'example');
      const { testEntries } = await runPlaywrightTest('simple.spec.js', {
        TESTOMATIO_WORKDIR: customWorkdir,
      });

      // Check that file paths are relative to custom workdir
      testEntries.forEach(entry => {
        if (entry.testId && entry.testId.file) {
          expect(entry.testId.file).to.not.match(/^\/home/);
          // Normalize path separators for cross-platform compatibility
          const normalizedPath = entry.testId.file.replace(/\\/g, '/');
          expect(normalizedPath).to.include('playwright/tests/simple.spec.js');
        }
      });
    });
  });

  describe('Test Status and Metadata', () => {
    it('should capture test metadata including browser and project info', async () => {
      const { testEntries } = await runPlaywrightTest();

      // Check that all tests have proper metadata
      testEntries.forEach(entry => {
        expect(entry.testId).to.exist;
        expect(entry.testId.meta).to.exist;
        expect(entry.testId.meta.browser).to.exist;
        expect(entry.testId.meta.project).to.exist;

        // Browser should be one of the configured browsers
        expect(['chromium', 'firefox', 'webkit']).to.include(entry.testId.meta.browser);

        // Should have project name
        expect(entry.testId.meta.project).to.be.a('string');
      });
    });

    it('should capture different test statuses (passed, failed)', async () => {
      const { testEntries } = await runPlaywrightTest();

      // Check for different test statuses
      const statuses = testEntries.map(entry => entry.testId.status);

      // Should have both passed and failed tests
      expect(statuses).to.include('passed');
      expect(statuses).to.include('failed');
      expect(testEntries.length).to.be.greaterThan(1);
    });
  });
});
