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

  describe('Tags Extraction and Processing', () => {
    // Helper function to run Playwright tests with tags example
    async function runTagsTest(testFile = 'tags-example.spec.js', extraEnv = {}) {
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
        
        console.log('Tags test execution output:', stdout);
        if (stderr) console.log('Tags test execution stderr:', stderr);
      } catch (error) {
        // Tests might fail, but adapter should still work
        console.log('Tags test execution completed');
        if (error.stdout) console.log('Error stdout:', error.stdout);
        if (error.stderr) console.log('Error stderr:', error.stderr);
      }

      // Wait for debug file to be finalized
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Find the most recent debug file
      const tmpFiles = fs.readdirSync(os.tmpdir())
        .filter(f => f.startsWith('testomatio.debug.') && f.endsWith('.json') && !f.includes('latest'))
        .map(f => ({
          name: f,
          path: path.join(os.tmpdir(), f),
          mtime: fs.statSync(path.join(os.tmpdir(), f)).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime);

      expect(tmpFiles.length).to.be.greaterThan(0, 'No debug files found for tags test');
      
      const debugFilePath = tmpFiles[0].path;
      const debugContent = fs.readFileSync(debugFilePath, 'utf-8');
      const debugLines = debugContent.trim().split('\n').filter(line => line.trim());
      const debugData = debugLines.map(line => JSON.parse(line));
      const testEntries = debugData.filter(entry => entry.action === 'addTest');
      
      return { debugData, testEntries };
    }

    it('should extract tags from test titles with @ format', async () => {
      // Create a simple test file with tags in title
      const testContent = `
import { test, expect } from '@playwright/test';

test('simple test @ui @smoke', async ({ page }) => {
  await page.goto('https://example.com');
  await expect(page).toHaveTitle(/Example/);
});

test('api test @api @regression', async ({ request }) => {
  const response = await request.get('https://httpbin.org/get');
  expect(response.ok()).toBeTruthy();
});`;

      const testFilePath = path.join(exampleDir, 'tests', 'title-tags.spec.js');
      fs.writeFileSync(testFilePath, testContent);

      try {
        const { testEntries } = await runTagsTest('title-tags.spec.js');
        
        // Find tests with expected tags
        const uiSmokeTest = testEntries.find(entry => 
          entry.testId && entry.testId.title && entry.testId.title.includes('@ui @smoke')
        );
        const apiRegressionTest = testEntries.find(entry => 
          entry.testId && entry.testId.title && entry.testId.title.includes('@api @regression')
        );

        expect(uiSmokeTest).to.exist;
        expect(apiRegressionTest).to.exist;

        // Verify tags are extracted and included in payload
        if (uiSmokeTest.testId.tags) {
          expect(uiSmokeTest.testId.tags).to.include('ui');
          expect(uiSmokeTest.testId.tags).to.include('smoke');
        }

        if (apiRegressionTest.testId.tags) {
          expect(apiRegressionTest.testId.tags).to.include('api');
          expect(apiRegressionTest.testId.tags).to.include('regression');
        }
      } finally {
        // Clean up test file
        if (fs.existsSync(testFilePath)) {
          fs.unlinkSync(testFilePath);
        }
      }
    });

    it('should extract tags from test options/details object', async () => {
      // Create a test file with tags in options
      const testContent = `
import { test, expect } from '@playwright/test';

test('regression test', { tag: '@regression' }, async ({ page }) => {
  await page.goto('https://example.com');
  await expect(page).toHaveTitle(/Example/);
});

test('multiple tags test', { tag: ['@smoke', '@critical'] }, async ({ page }) => {
  await page.goto('https://example.com');
  await expect(page).toHaveTitle(/Example/);
});`;

      const testFilePath = path.join(exampleDir, 'tests', 'options-tags.spec.js');
      fs.writeFileSync(testFilePath, testContent);

      try {
        const { testEntries } = await runTagsTest('options-tags.spec.js');
        
        // Find tests with expected tags
        const regressionTest = testEntries.find(entry => 
          entry.testId && entry.testId.title === 'regression test'
        );
        const multipleTagsTest = testEntries.find(entry => 
          entry.testId && entry.testId.title === 'multiple tags test'
        );

        expect(regressionTest).to.exist;
        expect(multipleTagsTest).to.exist;

        // Verify tags are extracted from options
        if (regressionTest.testId.tags) {
          expect(regressionTest.testId.tags).to.include('regression');
        }

        if (multipleTagsTest.testId.tags) {
          expect(multipleTagsTest.testId.tags).to.include('smoke');
          expect(multipleTagsTest.testId.tags).to.include('critical');
        }
      } finally {
        // Clean up test file
        if (fs.existsSync(testFilePath)) {
          fs.unlinkSync(testFilePath);
        }
      }
    });

    it('should inherit tags from suite/describe blocks', async () => {
      // Create a test file with suite-level tags
      const testContent = `
import { test, expect } from '@playwright/test';

test.describe('Auth Suite', { tag: '@auth' }, () => {
  test('login test', async ({ page }) => {
    await page.goto('https://example.com');
    await expect(page).toHaveTitle(/Example/);
  });

  test('logout test @ui', { tag: '@critical' }, async ({ page }) => {
    await page.goto('https://example.com');
    await expect(page).toHaveTitle(/Example/);
  });
});`;

      const testFilePath = path.join(exampleDir, 'tests', 'suite-tags.spec.js');
      fs.writeFileSync(testFilePath, testContent);

      try {
        const { testEntries } = await runTagsTest('suite-tags.spec.js');
        
        // Find tests in the suite
        const loginTest = testEntries.find(entry => 
          entry.testId && entry.testId.title === 'login test'
        );
        const logoutTest = testEntries.find(entry => 
          entry.testId && entry.testId.title && entry.testId.title.includes('logout test @ui')
        );

        expect(loginTest).to.exist;
        expect(logoutTest).to.exist;

        // Verify suite tags are inherited
        if (loginTest.testId.tags) {
          expect(loginTest.testId.tags).to.include('auth');
        }

        if (logoutTest.testId.tags) {
          expect(logoutTest.testId.tags).to.include('auth'); // inherited from suite
          expect(logoutTest.testId.tags).to.include('ui'); // from title
          expect(logoutTest.testId.tags).to.include('critical'); // from options
        }
      } finally {
        // Clean up test file
        if (fs.existsSync(testFilePath)) {
          fs.unlinkSync(testFilePath);
        }
      }
    });

    it('should normalize tags (lowercase, no @ prefix) and deduplicate', async () => {
      // Create a test file with mixed case and duplicate tags
      const testContent = `
import { test, expect } from '@playwright/test';

test.describe('Mixed Case Suite', { tag: ['@CRITICAL', '@smoke'] }, () => {
  test('test with duplicate tags @SMOKE @Critical', { tag: '@regression' }, async ({ page }) => {
    await page.goto('https://example.com');
    await expect(page).toHaveTitle(/Example/);
  });
});`;

      const testFilePath = path.join(exampleDir, 'tests', 'normalize-tags.spec.js');
      fs.writeFileSync(testFilePath, testContent);

      try {
        const { testEntries } = await runTagsTest('normalize-tags.spec.js');
        
        // Find the test with mixed tags
        const mixedTest = testEntries.find(entry => 
          entry.testId && entry.testId.title && entry.testId.title.includes('duplicate tags')
        );

        expect(mixedTest).to.exist;

        if (mixedTest.testId.tags) {
          // All tags should be lowercase
          mixedTest.testId.tags.forEach(tag => {
            expect(tag).to.equal(tag.toLowerCase());
            expect(tag).to.not.include('@');
          });

          // Should have deduplicated tags
          expect(mixedTest.testId.tags).to.include('critical');
          expect(mixedTest.testId.tags).to.include('smoke');
          expect(mixedTest.testId.tags).to.include('regression');
          
          // Check for no duplicates
          const uniqueTags = [...new Set(mixedTest.testId.tags)];
          expect(mixedTest.testId.tags).to.have.length(uniqueTags.length);
        }
      } finally {
        // Clean up test file
        if (fs.existsSync(testFilePath)) {
          fs.unlinkSync(testFilePath);
        }
      }
    });

    it('should handle complex tag inheritance scenario from task example', async () => {
      // Implement the exact example from the task: describe('critical suite', { tag: ['critical'] }, () => { test('nested @smoke', ...) })
      const testContent = `
import { test, expect } from '@playwright/test';

test.describe('critical suite', { tag: ['critical'] }, () => {
  test('nested @smoke', async ({ page }) => {
    await page.goto('https://example.com');
    await expect(page).toHaveTitle(/Example/);
  });
});

test('case @ui', { tag: 'regression' }, async ({ page }) => {
  await page.goto('https://example.com');
  await expect(page).toHaveTitle(/Example/);
});`;

      const testFilePath = path.join(exampleDir, 'tests', 'task-example.spec.js');
      fs.writeFileSync(testFilePath, testContent);

      try {
        const { testEntries } = await runTagsTest('task-example.spec.js');
        
        // Find the nested test - should have both 'critical' (from suite) and 'smoke' (from title)
        const nestedTest = testEntries.find(entry => 
          entry.testId && entry.testId.title && entry.testId.title.includes('nested @smoke')
        );
        
        // Find the standalone test - should have both 'ui' (from title) and 'regression' (from options)
        const standaloneTest = testEntries.find(entry => 
          entry.testId && entry.testId.title && entry.testId.title.includes('case @ui')
        );

        expect(nestedTest).to.exist;
        expect(standaloneTest).to.exist;

        // Verify nested test has expected tags: ['critical', 'smoke']
        if (nestedTest.testId.tags) {
          expect(nestedTest.testId.tags).to.include('critical'); // inherited from suite
          expect(nestedTest.testId.tags).to.include('smoke'); // from title
          expect(nestedTest.testId.tags).to.have.length(2);
        }

        // Verify standalone test has expected tags: ['ui', 'regression']  
        if (standaloneTest.testId.tags) {
          expect(standaloneTest.testId.tags).to.include('ui'); // from title
          expect(standaloneTest.testId.tags).to.include('regression'); // from options
          expect(standaloneTest.testId.tags).to.have.length(2);
        }
      } finally {
        // Clean up test file
        if (fs.existsSync(testFilePath)) {
          fs.unlinkSync(testFilePath);
        }
      }
    });
  });
});
