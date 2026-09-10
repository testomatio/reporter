import { expect } from 'chai';
import { afterEach, before, beforeEach, describe, it } from 'mocha';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { extractTags } from '../../src/adapter/playwright.js';

const execAsync = promisify(exec);

describe('Playwright Tags Extraction', () => {
  describe('adapter integration', function () {
    this.timeout(60000);

    let debugFilePath;
    let exampleDir;

    before(() => {
      exampleDir = path.join(process.cwd(), 'example', 'playwright');
    });

    beforeEach(() => {
      // Debug file (symlink) is created in the cwd of the spawned Playwright process,
      // which is exampleDir — not the test runner's cwd.
      debugFilePath = path.join(exampleDir, 'testomatio.debug.json');
      if (fs.existsSync(debugFilePath)) {
        fs.unlinkSync(debugFilePath);
      }
    });

    afterEach(() => {
      if (fs.existsSync(debugFilePath)) {
        fs.unlinkSync(debugFilePath);
      }
    });

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
        console.log('Tags test execution completed');
        if (error.stdout) console.log('Error stdout:', error.stdout);
        if (error.stderr) console.log('Error stderr:', error.stderr);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      const debugPath = path.join(exampleDir, 'testomatio.debug.json');
      expect(fs.existsSync(debugPath), 'Debug file not found').to.be.true;

      const debugContent = fs.readFileSync(debugPath, 'utf-8');
      const debugLines = debugContent
        .trim()
        .split('\n')
        .filter(line => line.trim());
      const debugData = debugLines.map(line => JSON.parse(line));
      // DebugPipe buffers tests and flushes them as a single `addTestsBatch` entry on sync/finishRun.
      // Flatten those batches into per-test entries shaped like the legacy `addTest` log
      // ({ testId: <testData> }) so the assertions below can stay test-data oriented.
      const testEntries = debugData
        .filter(entry => entry.action === 'addTestsBatch')
        .flatMap(entry => (entry.tests || []).map(test => ({ action: 'addTest', testId: test })));

      return { debugData, testEntries };
    }

    describe('Tags Extraction and Processing', () => {
      it('should extract tags from test titles with @ format', async () => {
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

          const uiSmokeTest = testEntries.find(
            entry => entry.testId && entry.testId.title && entry.testId.title.includes('@ui @smoke'),
          );
          const apiRegressionTest = testEntries.find(
            entry => entry.testId && entry.testId.title && entry.testId.title.includes('@api @regression'),
          );

          expect(uiSmokeTest).to.exist;
          expect(apiRegressionTest).to.exist;

          if (uiSmokeTest.testId.tags) {
            expect(uiSmokeTest.testId.tags).to.include('ui');
            expect(uiSmokeTest.testId.tags).to.include('smoke');
          }

          if (apiRegressionTest.testId.tags) {
            expect(apiRegressionTest.testId.tags).to.include('api');
            expect(apiRegressionTest.testId.tags).to.include('regression');
          }
        } finally {
          if (fs.existsSync(testFilePath)) {
            fs.unlinkSync(testFilePath);
          }
        }
      });

      it('should extract tags from test options/details object', async () => {
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

          const regressionTest = testEntries.find(entry => entry.testId && entry.testId.title === 'regression test');
          const multipleTagsTest = testEntries.find(
            entry => entry.testId && entry.testId.title === 'multiple tags test',
          );

          expect(regressionTest).to.exist;
          expect(multipleTagsTest).to.exist;

          if (regressionTest.testId.tags) {
            expect(regressionTest.testId.tags).to.include('regression');
          }

          if (multipleTagsTest.testId.tags) {
            expect(multipleTagsTest.testId.tags).to.include('smoke');
            expect(multipleTagsTest.testId.tags).to.include('critical');
          }
        } finally {
          if (fs.existsSync(testFilePath)) {
            fs.unlinkSync(testFilePath);
          }
        }
      });

      it('should inherit tags from suite/describe blocks', async () => {
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

          const loginTest = testEntries.find(entry => entry.testId && entry.testId.title === 'login test');
          const logoutTest = testEntries.find(
            entry => entry.testId && entry.testId.title && entry.testId.title.includes('logout test @ui'),
          );

          expect(loginTest).to.exist;
          expect(logoutTest).to.exist;

          if (loginTest.testId.tags) {
            expect(loginTest.testId.tags).to.include('auth');
          }

          if (logoutTest.testId.tags) {
            expect(logoutTest.testId.tags).to.include('auth');
            expect(logoutTest.testId.tags).to.include('ui');
            expect(logoutTest.testId.tags).to.include('critical');
          }
        } finally {
          if (fs.existsSync(testFilePath)) {
            fs.unlinkSync(testFilePath);
          }
        }
      });

      it('should deduplicate tags (case-insensitive) and preserve original case', async () => {
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

          const mixedTest = testEntries.find(
            entry => entry.testId && entry.testId.title && entry.testId.title.includes('duplicate tags'),
          );

          expect(mixedTest).to.exist;

          if (mixedTest.testId.tags) {
            mixedTest.testId.tags.forEach(tag => {
              expect(tag).to.not.include('@');
            });

            expect(mixedTest.testId.tags).to.have.length(3);

            const lowercaseTags = mixedTest.testId.tags.map(t => t.toLowerCase());
            expect(lowercaseTags).to.include.members(['critical', 'smoke', 'regression']);

            const tagSet = new Set(mixedTest.testId.tags.map(t => t.toLowerCase()));
            expect(tagSet.size).to.equal(3, 'Should have exactly 3 unique tags after case-insensitive deduplication');
          }
        } finally {
          if (fs.existsSync(testFilePath)) {
            fs.unlinkSync(testFilePath);
          }
        }
      });

      it('should preserve Testomatio IDs (@T...) in tags', async () => {
        const testContent = `
import { test, expect } from '@playwright/test';

test('test with ID @T12345678 @smoke', async ({ page }) => {
  await page.goto('https://example.com');
  await expect(page).toHaveTitle(/Example/);
});`;

        const testFilePath = path.join(exampleDir, 'tests', 'testomatio-id.spec.js');
        fs.writeFileSync(testFilePath, testContent);

        try {
          const { testEntries } = await runTagsTest('testomatio-id.spec.js');

          const testWithId = testEntries.find(
            entry => entry.testId && entry.testId.title && entry.testId.title.includes('@T12345678'),
          );

          expect(testWithId).to.exist;

          if (testWithId.testId.test_id) {
            expect(testWithId.testId.test_id).to.equal('@T12345678');
          }

          if (testWithId.testId.tags) {
            expect(testWithId.testId.tags).to.include('T12345678');
            expect(testWithId.testId.tags).to.include('smoke');
          }
        } finally {
          if (fs.existsSync(testFilePath)) {
            fs.unlinkSync(testFilePath);
          }
        }
      });

      it('should preserve suite IDs (@S...) and strip @ in payload', async () => {
        const testContent = `
import { test, expect } from '@playwright/test';

test.describe('Suite with ID', { tag: '@S100' }, () => {
  test('test with @smoke', async ({ page }) => {
    await page.goto('https://example.com');
    await expect(page).toHaveTitle(/Example/);
  });
});`;

        const testFilePath = path.join(exampleDir, 'tests', 'suite-id-tags.spec.js');
        fs.writeFileSync(testFilePath, testContent);

        try {
          const { testEntries } = await runTagsTest('suite-id-tags.spec.js');

          const testWithSuiteId = testEntries.find(
            entry => entry.testId && entry.testId.title && entry.testId.title.includes('test with @smoke'),
          );

          expect(testWithSuiteId).to.exist;

          if (testWithSuiteId.testId.tags) {
            expect(testWithSuiteId.testId.tags).to.include('S100');
            expect(testWithSuiteId.testId.tags).to.include('smoke');
          }
        } finally {
          if (fs.existsSync(testFilePath)) {
            fs.unlinkSync(testFilePath);
          }
        }
      });

      it('should handle complex tag inheritance scenario from task example', async () => {
        const testContent = `
import { test, expect } from '@playwright/test';

test.describe('critical suite', { tag: ['@critical'] }, () => {
  test('nested @smoke', async ({ page }) => {
    await page.goto('https://example.com');
    await expect(page).toHaveTitle(/Example/);
  });
});

test('case @ui', { tag: '@regression' }, async ({ page }) => {
  await page.goto('https://example.com');
  await expect(page).toHaveTitle(/Example/);
});`;

        const testFilePath = path.join(exampleDir, 'tests', 'task-example.spec.js');
        fs.writeFileSync(testFilePath, testContent);

        try {
          const { testEntries } = await runTagsTest('task-example.spec.js');

          const nestedTest = testEntries.find(
            entry => entry.testId && entry.testId.title && entry.testId.title.includes('nested @smoke'),
          );

          const standaloneTest = testEntries.find(
            entry => entry.testId && entry.testId.title && entry.testId.title.includes('case @ui'),
          );

          expect(nestedTest).to.exist;
          expect(standaloneTest).to.exist;

          if (nestedTest.testId.tags) {
            expect(nestedTest.testId.tags).to.include('critical');
            expect(nestedTest.testId.tags).to.include('smoke');
            expect(nestedTest.testId.tags).to.have.length(2);
          }

          if (standaloneTest.testId.tags) {
            expect(standaloneTest.testId.tags).to.include('ui');
            expect(standaloneTest.testId.tags).to.include('regression');
            expect(standaloneTest.testId.tags).to.have.length(2);
          }
        } finally {
          if (fs.existsSync(testFilePath)) {
            fs.unlinkSync(testFilePath);
          }
        }
      });
    });
  });

  describe('extractTags function', () => {
    it('should extract tags from test title with @tag format', () => {
      const testMock = {
        title: 'test case @ui @smoke',
        tags: null,
        parent: null,
      };

      const tags = extractTags(testMock);
      expect(tags).to.include('@ui');
      expect(tags).to.include('@smoke');
      expect(tags).to.have.length(2);
    });

    it('should extract tags from test title with mixed case and normalize', () => {
      const testMock = {
        title: 'test case @REGRESSION @Smoke',
        tags: null,
        parent: null,
      };

      const tags = extractTags(testMock);
      expect(tags).to.include('@REGRESSION');
      expect(tags).to.include('@Smoke');
      expect(tags).to.have.length(2);
    });

    it('should extract tags from test.tags array', () => {
      const testMock = {
        title: 'test case',
        tags: ['critical', 'api'],
        parent: null,
      };

      const tags = extractTags(testMock);
      expect(tags).to.include('@critical');
      expect(tags).to.include('@api');
      expect(tags).to.have.length(2);
    });

    it('should extract and normalize tags with @ prefix from test.tags', () => {
      const testMock = {
        title: 'test case',
        tags: ['@critical', '@api'],
        parent: null,
      };

      const tags = extractTags(testMock);
      expect(tags).to.include('@critical');
      expect(tags).to.include('@api');
      expect(tags).to.have.length(2);
    });

    it('should combine tags from title and test.tags', () => {
      const testMock = {
        title: 'test case @ui',
        tags: ['critical', 'api'],
        parent: null,
      };

      const tags = extractTags(testMock);
      expect(tags).to.include('@ui');
      expect(tags).to.include('@critical');
      expect(tags).to.include('@api');
      expect(tags).to.have.length(3);
    });

    it('should deduplicate tags from multiple sources', () => {
      const testMock = {
        title: 'test case @ui @critical',
        tags: ['critical', 'ui', 'api'],
        parent: null,
      };

      const tags = extractTags(testMock);
      expect(tags).to.include('@ui');
      expect(tags).to.include('@critical');
      expect(tags).to.include('@api');
      expect(tags).to.have.length(3); // Should deduplicate ui and critical
    });

    it('should extract tags from test title and test tags only', () => {
      const parentMock = {
        tags: ['suite-tag', 'integration'],
        parent: null,
      };

      const testMock = {
        title: 'test case @ui',
        tags: ['critical'],
        parent: parentMock,
      };

      const tags = extractTags(testMock);
      expect(tags).to.include('@ui');
      expect(tags).to.include('@critical');
      expect(tags).to.have.length(2); // Only test-level tags, not parent tags
    });

    it('should extract tags without inheritance from parent levels', () => {
      const grandParentMock = {
        tags: ['root-tag'],
        parent: null,
      };

      const parentMock = {
        tags: ['suite-tag'],
        parent: grandParentMock,
      };

      const testMock = {
        title: 'test case @ui',
        tags: ['critical'],
        parent: parentMock,
      };

      const tags = extractTags(testMock);
      expect(tags).to.include('@ui');
      expect(tags).to.include('@critical');
      expect(tags).to.have.length(2); // Only test-level tags
    });

    it('should handle empty tags gracefully', () => {
      const testMock = {
        title: 'test case without tags',
        tags: null,
        parent: null,
      };

      const tags = extractTags(testMock);
      expect(tags).to.be.an('array');
      expect(tags).to.have.length(0);
    });

    it('should handle test with no parent', () => {
      const testMock = {
        title: 'test case @ui',
        tags: ['critical'],
        parent: null,
      };

      const tags = extractTags(testMock);
      expect(tags).to.include('@ui');
      expect(tags).to.include('@critical');
      expect(tags).to.have.length(2);
    });

    it('should handle parent with no tags', () => {
      const parentMock = {
        tags: null,
        parent: null,
      };

      const testMock = {
        title: 'test case @ui',
        tags: ['critical'],
        parent: parentMock,
      };

      const tags = extractTags(testMock);
      expect(tags).to.include('@ui');
      expect(tags).to.include('@critical');
      expect(tags).to.have.length(2);
    });

    it('should normalize mixed case tags from test sources only', () => {
      const parentMock = {
        tags: ['SUITE-TAG'],
        parent: null,
      };

      const testMock = {
        title: 'test case @UI @SMOKE',
        tags: ['Critical', 'API'],
        parent: parentMock,
      };

      const tags = extractTags(testMock);
      expect(tags).to.include('@UI');
      expect(tags).to.include('@SMOKE');
      expect(tags).to.include('@Critical');
      expect(tags).to.include('@API');
      expect(tags).to.have.length(4); // Only test-level tags, not parent tags
    });

    it('should handle test with only title tags', () => {
      // Simulate: describe('critical suite', { tag: ['critical'] }, () => { test('nested @smoke', ...) })
      const suiteMock = {
        title: 'critical suite',
        tags: ['critical'],
        parent: null,
      };

      const testMock = {
        title: 'nested @smoke',
        tags: null,
        parent: suiteMock,
      };

      const tags = extractTags(testMock);
      expect(tags).to.include('@smoke'); // from title only
      expect(tags).to.have.length(1); // Only test-level tags
    });

    it('should handle test with both title tags and options tags like in task example', () => {
      // Simulate: test('case @ui', { tag: 'regression' }, async () => {});
      const testMock = {
        title: 'case @ui',
        tags: ['regression'],
        parent: null,
      };

      const tags = extractTags(testMock);
      expect(tags).to.include('@ui'); // from title
      expect(tags).to.include('@regression'); // from options
      expect(tags).to.have.length(2);
    });

    it('should deduplicate tags case-insensitively and keep first casing', () => {
      const testMock = {
        title: 'my test @SMOKE',
        tags: ['smoke', 'Smoke'],
        parent: null,
      };

      const result = extractTags(testMock);
      expect(result).to.have.length(1);
      expect(result[0]).to.equal('@SMOKE');
    });

    it('should preserve original case of first occurrence', () => {
      const testMock = {
        title: 'my test @CriticalBug',
        tags: ['criticalbug', 'CRITICALBUG'],
        parent: null,
      };

      const result = extractTags(testMock);
      expect(result).to.have.length(1);
      expect(result[0]).to.equal('@CriticalBug');
    });

    it('should handle Testomatio IDs correctly (8 chars after @T)', () => {
      const testMock = {
        title: 'my test @TABCDEFGH @smoke',
        tags: [],
        parent: null,
      };

      const result = extractTags(testMock);
      expect(result).to.deep.equal(['@TABCDEFGH', '@smoke']);
      expect(result[0]).to.match(/^@T.{8}$/);
    });

    it('should handle suite IDs (@S...) correctly', () => {
      const testMock = {
        title: 'suite tagged test @S555 @ui',
        tags: [],
        parent: null,
      };

      const result = extractTags(testMock);
      expect(result).to.deep.equal(['@S555', '@ui']);
      expect(result[0]).to.include('@S');
    });

    it('should handle undefined test.tags', () => {
      const testMock = {
        title: 'my test @smoke',
        parent: null,
      };

      const result = extractTags(testMock);
      expect(result).to.deep.equal(['@smoke']);
    });

    it('should ignore non-string tags in test.tags array', () => {
      const testMock = {
        title: 'my test',
        tags: [123, true, null, undefined],
        parent: null,
      };

      const result = extractTags(testMock);
      expect(result).to.deep.equal([]);
    });
  });
});
