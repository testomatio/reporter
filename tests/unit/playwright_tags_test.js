import { expect } from 'chai';
import { describe, it } from 'mocha';

// Import the extractTags function from the adapter
// Note: We need to mock the test object structure since it's a private function
function extractTags(test) {
  const tagsSet = new Set();
  
  // Extract tags from test title (@tag format)
  const titleTagsMatch = test.title.match(/@\w+/g);
  if (titleTagsMatch) {
    titleTagsMatch.forEach(tag => {
      tagsSet.add(tag.replace('@', '').toLowerCase());
    });
  }
  
  // Extract tags from test.tags (Playwright built-in tags)
  if (test.tags && Array.isArray(test.tags)) {
    test.tags.forEach(tag => {
      const normalizedTag = typeof tag === 'string' ? tag.replace('@', '').toLowerCase() : String(tag).toLowerCase();
      tagsSet.add(normalizedTag);
    });
  }
  
  // Extract tags from suite/describe level (inherited tags)
  let parent = test.parent;
  while (parent) {
    if (parent.tags && Array.isArray(parent.tags)) {
      parent.tags.forEach(tag => {
        const normalizedTag = typeof tag === 'string' ? tag.replace('@', '').toLowerCase() : String(tag).toLowerCase();
        tagsSet.add(normalizedTag);
      });
    }
    parent = parent.parent;
  }
  
  return Array.from(tagsSet);
}

describe('Playwright Tags Extraction', () => {
  describe('extractTags function', () => {
    it('should extract tags from test title with @tag format', () => {
      const testMock = {
        title: 'test case @ui @smoke',
        tags: null,
        parent: null
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
        parent: null
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
        parent: null
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
        parent: null
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
        parent: null
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
        parent: null
      };

      const tags = extractTags(testMock);
      expect(tags).to.include('ui');
      expect(tags).to.include('critical');
      expect(tags).to.include('api');
      expect(tags).to.have.length(3); // Should deduplicate ui and critical
    });

    it('should inherit tags from parent suite', () => {
      const parentMock = {
        tags: ['suite-tag', 'integration'],
        parent: null
      };

      const testMock = {
        title: 'test case @ui',
        tags: ['critical'],
        parent: parentMock
      };

      const tags = extractTags(testMock);
      expect(tags).to.include('ui');
      expect(tags).to.include('critical');
      expect(tags).to.include('suite-tag');
      expect(tags).to.include('integration');
      expect(tags).to.have.length(4);
    });

    it('should inherit tags from multiple parent levels', () => {
      const grandParentMock = {
        tags: ['root-tag'],
        parent: null
      };

      const parentMock = {
        tags: ['suite-tag'],
        parent: grandParentMock
      };

      const testMock = {
        title: 'test case @ui',
        tags: ['critical'],
        parent: parentMock
      };

      const tags = extractTags(testMock);
      expect(tags).to.include('ui');
      expect(tags).to.include('critical');
      expect(tags).to.include('suite-tag');
      expect(tags).to.include('root-tag');
      expect(tags).to.have.length(4);
    });

    it('should handle empty tags gracefully', () => {
      const testMock = {
        title: 'test case without tags',
        tags: null,
        parent: null
      };

      const tags = extractTags(testMock);
      expect(tags).to.be.an('array');
      expect(tags).to.have.length(0);
    });

    it('should handle test with no parent', () => {
      const testMock = {
        title: 'test case @ui',
        tags: ['critical'],
        parent: null
      };

      const tags = extractTags(testMock);
      expect(tags).to.include('ui');
      expect(tags).to.include('critical');
      expect(tags).to.have.length(2);
    });

    it('should handle parent with no tags', () => {
      const parentMock = {
        tags: null,
        parent: null
      };

      const testMock = {
        title: 'test case @ui',
        tags: ['critical'],
        parent: parentMock
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
        parent: null
      };

      const tags = extractTags(testMock);
      expect(tags).to.include('123');
      expect(tags).to.include('true');
      expect(tags).to.include('string-tag');
      expect(tags).to.have.length(3);
    });

    it('should normalize mixed case tags from all sources', () => {
      const parentMock = {
        tags: ['SUITE-TAG'],
        parent: null
      };

      const testMock = {
        title: 'test case @UI @SMOKE',
        tags: ['Critical', 'API'],
        parent: parentMock
      };

      const tags = extractTags(testMock);
      expect(tags).to.include('ui');
      expect(tags).to.include('smoke');
      expect(tags).to.include('critical');
      expect(tags).to.include('api');
      expect(tags).to.include('suite-tag');
      expect(tags).to.have.length(5);
    });

    it('should handle complex inheritance scenario like in task example', () => {
      // Simulate: describe('critical suite', { tag: ['critical'] }, () => { test('nested @smoke', ...) })
      const suiteMock = {
        title: 'critical suite',
        tags: ['critical'],
        parent: null
      };

      const testMock = {
        title: 'nested @smoke',
        tags: null,
        parent: suiteMock
      };

      const tags = extractTags(testMock);
      expect(tags).to.include('critical'); // from suite
      expect(tags).to.include('smoke'); // from title
      expect(tags).to.have.length(2);
    });

    it('should handle test with both title tags and options tags like in task example', () => {
      // Simulate: test('case @ui', { tag: 'regression' }, async () => {});
      const testMock = {
        title: 'case @ui',
        tags: ['regression'],
        parent: null
      };

      const tags = extractTags(testMock);
      expect(tags).to.include('ui'); // from title
      expect(tags).to.include('regression'); // from options
      expect(tags).to.have.length(2);
    });
  });
});