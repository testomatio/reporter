import { expect } from 'chai';
import { describe, it } from 'mocha';
import { extractTags } from '../../src/adapter/playwright.js';

describe('Playwright Tags Extraction', () => {
  describe('extractTags function', () => {
    it('should extract tags from test title with @tag format', () => {
      const testMock = {
        title: 'test case @ui @smoke',
        tags: null,
        parent: null,
      };

      const tags = extractTags(testMock);
      expect(tags).to.include('ui');
      expect(tags).to.include('smoke');
      expect(tags).to.have.length(2);
    });

    it('should extract tags from test title with mixed case and normalize', () => {
      const testMock = {
        title: 'test case @REGRESSION @Smoke',
        tags: null,
        parent: null,
      };

      const tags = extractTags(testMock);
      expect(tags).to.include('regression');
      expect(tags).to.include('smoke');
      expect(tags).to.have.length(2);
    });

    it('should extract tags from test.tags array', () => {
      const testMock = {
        title: 'test case',
        tags: ['critical', 'api'],
        parent: null,
      };

      const tags = extractTags(testMock);
      expect(tags).to.include('critical');
      expect(tags).to.include('api');
      expect(tags).to.have.length(2);
    });

    it('should extract and normalize tags with @ prefix from test.tags', () => {
      const testMock = {
        title: 'test case',
        tags: ['@critical', '@api'],
        parent: null,
      };

      const tags = extractTags(testMock);
      expect(tags).to.include('critical');
      expect(tags).to.include('api');
      expect(tags).to.have.length(2);
    });

    it('should combine tags from title and test.tags', () => {
      const testMock = {
        title: 'test case @ui',
        tags: ['critical', 'api'],
        parent: null,
      };

      const tags = extractTags(testMock);
      expect(tags).to.include('ui');
      expect(tags).to.include('critical');
      expect(tags).to.include('api');
      expect(tags).to.have.length(3);
    });

    it('should deduplicate tags from multiple sources', () => {
      const testMock = {
        title: 'test case @ui @critical',
        tags: ['critical', 'ui', 'api'],
        parent: null,
      };

      const tags = extractTags(testMock);
      expect(tags).to.include('ui');
      expect(tags).to.include('critical');
      expect(tags).to.include('api');
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
      expect(tags).to.include('ui');
      expect(tags).to.include('critical');
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
      expect(tags).to.include('ui');
      expect(tags).to.include('critical');
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
      expect(tags).to.include('ui');
      expect(tags).to.include('critical');
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
      expect(tags).to.include('ui');
      expect(tags).to.include('critical');
      expect(tags).to.have.length(2);
    });

    it('should handle non-string tags in arrays', () => {
      const testMock = {
        title: 'test case',
        tags: [123, true, 'string-tag'],
        parent: null,
      };

      const tags = extractTags(testMock);
      expect(tags).to.include('123');
      expect(tags).to.include('true');
      expect(tags).to.include('string-tag');
      expect(tags).to.have.length(3);
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
      expect(tags).to.include('ui');
      expect(tags).to.include('smoke');
      expect(tags).to.include('critical');
      expect(tags).to.include('api');
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
      expect(tags).to.include('smoke'); // from title only
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
      expect(tags).to.include('ui'); // from title
      expect(tags).to.include('regression'); // from options
      expect(tags).to.have.length(2);
    });
  });
});
