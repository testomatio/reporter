import { expect } from 'chai';
import { formatFilterListIds } from '../../src/utils/pipe_utils.js';

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
