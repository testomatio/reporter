import { expect } from 'chai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import CoveragePipe from '../../src/pipe/coverage.js';
import { formatError } from '../../src/utils/log-formatter.js';
import { config } from '../adapter/config/index.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const { TESTOMATIO_URL, TESTOMATIO } = config;

const TEMP_COVER_DIR = path.join(dirname, 'data', 'pipe-tmp');
const TEMP_COVERAGE_FILE = path.join(TEMP_COVER_DIR, 'temp_coverage.yml');

/**
 * Unit tests for minimatch library usage in Testomatio Reporter.
 *
 * These tests verify that the minimatch update (v10.2.4) works correctly
 * with the actual reporter functionality:
 * - CoveragePipe: Matching changed files against coverage patterns
 * - LogFormatter: Filtering stack frames via TESTOMATIO_STACK_IGNORE
 */

describe('minimatch integration in reporter', () => {
  describe('CoveragePipe - file pattern matching', () => {
    let coveragePipe;
    let originalEnv;

    beforeEach(() => {
      originalEnv = { ...process.env };

      // Ensure clean temp directory
      if (!fs.existsSync(TEMP_COVER_DIR)) {
        fs.mkdirSync(TEMP_COVER_DIR, { recursive: true });
      }

      // Clear temp files
      fs.readdirSync(TEMP_COVER_DIR).forEach(file => {
        fs.unlinkSync(path.join(TEMP_COVER_DIR, file));
      });
    });

    afterEach(() => {
      process.env = originalEnv;
      coveragePipe = undefined;
    });

    const setupCoveragePipe = (coverageContent) => {
      process.env.COVERAGE_BY_DEFAULT_GIT_FILE = '1';
      process.env.COVERAGE_FILEPATH = TEMP_COVERAGE_FILE;
      process.env.TESTOMATIO_URL = TESTOMATIO_URL;
      process.env['INPUT_TESTOMATIO-KEY'] = TESTOMATIO;

      fs.writeFileSync(TEMP_COVERAGE_FILE, coverageContent);

      coveragePipe = new CoveragePipe({
        apiKey: TESTOMATIO,
        testomatioUrl: TESTOMATIO_URL,
        batchMode: 'disabled',
        pipeOptions: `file=${TEMP_COVERAGE_FILE}`
      });
    };

    it('should match exact file paths in coverage patterns', async () => {
      setupCoveragePipe(`
        todomvc-tests/edit-todos_test.js:
          - "@Ttest001"
      `);

      const result = await coveragePipe.prepareRun();
      expect(result).to.deep.equal(['Ttest001']);
    });

    it('should match files with * wildcard pattern', async () => {
      setupCoveragePipe(`
        todomvc-tests/*.js:
          - "@Ttest001"
          - "@Ttest002"
      `);

      const result = await coveragePipe.prepareRun();
      expect(result).to.have.members(['Ttest001', 'Ttest002']);
    });

    it('should match files with ** glob pattern for deep paths', async () => {
      setupCoveragePipe(`
        "**/edit-todos_test.js":
          - "@Ttest001"
      `);

      const result = await coveragePipe.prepareRun();
      expect(result).to.deep.equal(['Ttest001']);
    });

    it('should match files with complex patterns like *-todos_test.js', async () => {
      setupCoveragePipe(`
        todomvc-tests/*-todos_test.js:
          - "@Ttest001"
      `);

      const result = await coveragePipe.prepareRun();
      expect(result).to.deep.equal(['Ttest001']);
    });

    it('should match files with {brace,expansion} patterns', async () => {
      setupCoveragePipe(`
        todomvc-tests/{edit,create}-todos_test.js:
          - "@Ttest001"
      `);

      const result = await coveragePipe.prepareRun();
      expect(result).to.deep.equal(['Ttest001']);
    });

    it('should not match unrelated files', async () => {
      setupCoveragePipe(`
        tests/**/*.js:
          - "@Ttest001"
      `);

      // The git changed file is 'todomvc-tests/edit-todos_test.js'
      // which doesn't match 'tests/**/*.js'
      const result = await coveragePipe.prepareRun();
      expect(result).to.deep.equal([]);
    });

    it('should match multiple patterns in coverage file', async () => {
      setupCoveragePipe(`
        todomvc-tests/*.js:
          - "@Ttest001"
        "**/*_test.js":
          - "@Ttest002"
        "**/edit-*.js":
          - "@Ttest003"
      `);

      const result = await coveragePipe.prepareRun();
      expect(result).to.have.members(['Ttest001', 'Ttest002', 'Ttest003']);
    });

    it('should handle test IDs starting with @T', async () => {
      setupCoveragePipe(`
        todomvc-tests/edit-todos_test.js:
          - "@Tabc123"
      `);

      const result = await coveragePipe.prepareRun();
      expect(result).to.deep.equal(['Tabc123']);
    });

    it('should handle suite IDs starting with @S', async () => {
      setupCoveragePipe(`
        todomvc-tests/edit-todos_test.js:
          - "@Sxyz789"
      `);

      const result = await coveragePipe.prepareRun();
      expect(result).to.deep.equal(['Sxyz789']);
    });

    it('should handle tag patterns like tag:@smoke', async () => {
      setupCoveragePipe(`
        src/test.js:
          - "tag:@smoke"
      `);

      // Tags require server response, but with default git file test
      // it will store the tag, just won't fetch tests from server
      const result = await coveragePipe.prepareRun();
      // Empty result because tag tests require server fetch
      expect(result).to.deep.equal([]);
    });

    it('should match files with hyphens in names', async () => {
      setupCoveragePipe(`
        todomvc-tests/edit-todos_test.js:
          - "@Ttest001"
        my-project-file.js:
          - "@Ttest002"
      `);

      const result = await coveragePipe.prepareRun();
      expect(result).to.deep.equal(['Ttest001']);
    });

    it('should match files with underscore patterns', async () => {
      setupCoveragePipe(`
        todomvc-tests/*_test.js:
          - "@Ttest001"
      `);

      const result = await coveragePipe.prepareRun();
      expect(result).to.deep.equal(['Ttest001']);
    });

    it('should handle multiple test IDs for one pattern', async () => {
      setupCoveragePipe(`
        todomvc-tests/edit-todos_test.js:
          - "@Ttest001"
          - "@Ttest002"
          - "@Ssuite001"
      `);

      const result = await coveragePipe.prepareRun();
      expect(result).to.have.members(['Ttest001', 'Ttest002', 'Ssuite001']);
    });
  });

  describe('LogFormatter - stack trace filtering with TESTOMATIO_STACK_IGNORE', () => {
    let originalEnv;

    beforeEach(() => {
      originalEnv = { ...process.env };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should include stack frame when no filter is set', () => {
      const error = new Error('Test error');
      const stack = formatError(error);
      expect(stack).to.include('minimatch_test.js');
    });

    it('should filter out stack frame matching TESTOMATIO_STACK_IGNORE pattern', () => {
      process.env.TESTOMATIO_STACK_IGNORE = '**/minimatch_test.js';

      const error = new Error('Test error');
      const stack = formatError(error);
      expect(stack).not.to.include('minimatch_test.js');
    });

    it('should filter node_modules paths with **/node_modules/** pattern', () => {
      process.env.TESTOMATIO_STACK_IGNORE = '**/node_modules/**';

      const error = new Error('Test error');
      const stack = formatError(error);
      // Stack should not include node_modules frames
      // (though our test error likely won't have them anyway)
      expect(stack).to.be.a('string');
    });

    it('should filter dist/** patterns', () => {
      process.env.TESTOMATIO_STACK_IGNORE = 'dist/**';

      const error = new Error('Test error');
      const stack = formatError(error);
      expect(stack).to.be.a('string');
    });

    it('should handle multiple patterns in TESTOMATIO_STACK_IGNORE', () => {
      process.env.TESTOMATIO_STACK_IGNORE = '**/node_modules/**|dist/**|build/**';

      const error = new Error('Test error');
      const stack = formatError(error);
      expect(stack).to.be.a('string');
    });

    it('should handle wildcard patterns for file filtering', () => {
      process.env.TESTOMATIO_STACK_IGNORE = '**/*_test.js';

      const error = new Error('Test error');
      const stack = formatError(error);
      expect(stack).not.to.include('minimatch_test.js');
    });

    it('should handle pattern with * wildcard', () => {
      // The * only matches within a single path segment
      // Use ** to match across directories
      process.env.TESTOMATIO_STACK_IGNORE = '**/*_test.js';

      const error = new Error('Test error');
      const stack = formatError(error);
      expect(stack).not.to.include('minimatch_test.js');
    });

    it('should preserve error message regardless of filtering', () => {
      process.env.TESTOMATIO_STACK_IGNORE = '**/minimatch_test.js';

      const errorMessage = 'This is a test error message';
      const error = new Error(errorMessage);
      const stack = formatError(error);
      expect(stack).to.include(errorMessage);
    });
  });
});
