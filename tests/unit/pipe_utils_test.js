import { expect } from 'chai';
import { formatFilterListIds, getObjectSize, splitTestsIntoChunks } from '../../src/utils/pipe_utils.js';

describe('formatFilterListIds', () => {
  const ids = ['t1234abcd', 't5678efgh', 'tabcdef01'];

  it('returns empty string for empty or missing id list', () => {
    expect(formatFilterListIds([], 'grep')).to.equal('');
    expect(formatFilterListIds(undefined, 'json')).to.equal('');
    expect(formatFilterListIds(null, 'ids')).to.equal('');
  });

  it('defaults to ids (comma-separated) for unknown format', () => {
    expect(formatFilterListIds(ids, 'unknown-format')).to.equal('t1234abcd,t5678efgh,tabcdef01');
  });

  describe('grep format', () => {
    it('wraps ids in parentheses joined by pipe', () => {
      expect(formatFilterListIds(ids, 'grep')).to.equal('(t1234abcd|t5678efgh|tabcdef01)');
    });

    it('produces a single id wrapped in parens for one entry', () => {
      expect(formatFilterListIds(['only-one'], 'grep')).to.equal('(only-one)');
    });
  });

  describe('newline format', () => {
    it('joins ids with \\n with no trailing newline', () => {
      expect(formatFilterListIds(ids, 'newline')).to.equal('t1234abcd\nt5678efgh\ntabcdef01');
    });

    it('round-trips through split(\\n) back to original ids', () => {
      const out = formatFilterListIds(ids, 'newline');
      expect(out.split('\n')).to.deep.equal(ids);
    });
  });

  describe('ids format', () => {
    it('joins ids with comma', () => {
      expect(formatFilterListIds(ids, 'ids')).to.equal('t1234abcd,t5678efgh,tabcdef01');
    });

    it('round-trips through split(",") back to original ids', () => {
      const out = formatFilterListIds(ids, 'ids');
      expect(out.split(',')).to.deep.equal(ids);
    });
  });

  describe('json format', () => {
    it('produces valid JSON that parses back to the original array', () => {
      const out = formatFilterListIds(ids, 'json');
      const parsed = JSON.parse(out);
      expect(parsed).to.deep.equal(ids);
    });

    it('produces valid JSON for a single id', () => {
      const out = formatFilterListIds(['only-one'], 'json');
      expect(JSON.parse(out)).to.deep.equal(['only-one']);
    });

    it('escapes characters that would break JSON', () => {
      const tricky = ['has "quotes"', 'has\\backslash', 'has\nnewline', 'has\ttab'];
      const out = formatFilterListIds(tricky, 'json');
      expect(() => JSON.parse(out)).to.not.throw();
      expect(JSON.parse(out)).to.deep.equal(tricky);
    });
  });

  describe('format consistency', () => {
    it('every supported format contains every original id verbatim', () => {
      const formats = ['grep', 'newline', 'ids'];
      for (const format of formats) {
        const out = formatFilterListIds(ids, format);
        for (const id of ids) {
          expect(out, `format=${format} should contain "${id}"`).to.include(id);
        }
      }
      // json contains them too, but inside quotes
      const jsonOut = formatFilterListIds(ids, 'json');
      for (const id of ids) {
        expect(jsonOut, `format=json should contain "${id}"`).to.include(id);
      }
    });

    it('every supported format preserves id count and order', () => {
      const extractors = {
        grep: out => out.slice(1, -1).split('|'),
        newline: out => out.split('\n'),
        ids: out => out.split(','),
        json: out => JSON.parse(out),
      };
      for (const [format, extract] of Object.entries(extractors)) {
        const out = formatFilterListIds(ids, format);
        expect(extract(out), `format=${format} should round-trip`).to.deep.equal(ids);
      }
    });
  });
});

describe('splitTestsIntoChunks', () => {
  // build a test whose serialized size is roughly `bytes`
  const makeTest = (i, bytes = 100) => ({
    title: `Test ${i}`,
    status: 'passed',
    stack: 'x'.repeat(Math.max(0, bytes)),
  });

  it('returns no chunks for an empty array', () => {
    expect(splitTestsIntoChunks([])).to.deep.equal([]);
  });

  it('keeps a small suite in a single chunk', () => {
    const tests = Array.from({ length: 10 }, (_, i) => makeTest(i, 100));
    const chunks = splitTestsIntoChunks(tests);
    expect(chunks).to.have.length(1);
    expect(chunks[0]).to.have.length(10);
  });

  it('splits a large suite of 1000 tests into multiple chunks', () => {
    // ~50KB each → 1000 tests ≈ 50MB → must split well beyond a single 1MB chunk
    const tests = Array.from({ length: 1000 }, (_, i) => makeTest(i, 50_000));
    const chunks = splitTestsIntoChunks(tests);

    expect(chunks.length).to.be.greaterThan(1);

    // every test ends up in exactly one chunk, in order, none lost or duplicated
    const flat = chunks.flat();
    expect(flat).to.have.length(1000);
    expect(flat.map(t => t.title)).to.deep.equal(tests.map(t => t.title));
  });

  it('keeps each chunk at or below the size limit (except unavoidable oversized singletons)', () => {
    const maxSizeBytes = 1 * 1024 * 1024;
    const tests = Array.from({ length: 1000 }, (_, i) => makeTest(i, 50_000));
    const chunks = splitTestsIntoChunks(tests);

    for (const chunk of chunks) {
      const size = getObjectSize(chunk);
      // a chunk may exceed the limit only when it holds a single test bigger than the limit
      if (chunk.length > 1) {
        expect(size).to.be.at.most(maxSizeBytes);
      }
    }
  });

  it('places a single oversized test into its own chunk', () => {
    const tests = [
      makeTest(0, 100),
      makeTest(1, 2 * 1024 * 1024), // 2MB, bigger than the 1MB limit
      makeTest(2, 100),
    ];
    const chunks = splitTestsIntoChunks(tests);

    expect(chunks.flat()).to.have.length(3);
    // the oversized test is isolated in its own chunk
    const oversizedChunk = chunks.find(c => c.length === 1 && c[0].title === 'Test 1');
    expect(oversizedChunk, 'oversized test should be isolated').to.exist;
  });

  it('respects a custom maxSizeBytes', () => {
    const tests = Array.from({ length: 20 }, (_, i) => makeTest(i, 100));
    const single = splitTestsIntoChunks(tests, 10 * 1024 * 1024);
    const many = splitTestsIntoChunks(tests, 200); // tiny limit forces many chunks

    expect(single).to.have.length(1);
    expect(many.length).to.be.greaterThan(1);
    expect(many.flat()).to.have.length(20);
  });
});
