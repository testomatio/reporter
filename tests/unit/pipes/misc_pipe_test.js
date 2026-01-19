import { expect } from 'chai';
import { parseFilterParams, generateFilterRequestParams } from '../../../src/utils/pipe_utils.js';

describe('testing utils/pipe_utils.js functions', () => {
  describe('parseFilterParams function', () => {
    it('should parse single filter correctly', () => {
      const input = 'tag=123';
      const result = parseFilterParams(input);
      expect(result).to.deep.equal([{ type: 'tag', id: '123' }]);
    });

    it('should parse multiple filters correctly', () => {
      const input = 'tag=smoke,suite=login';
      const result = parseFilterParams(input);
      expect(result).to.deep.equal([
        { type: 'tag', id: 'smoke' },
        { type: 'suite', id: 'login' },
      ]);
    });

    it('should handle filter with equals in value', () => {
      const input = 'label=key=value';
      const result = parseFilterParams(input);
      expect(result).to.deep.equal([{ type: 'label', id: 'key=value' }]);
    });

    it('should return empty array for empty input', () => {
      const result = parseFilterParams('');
      expect(result).to.deep.equal([]);
    });

    it('should return empty array for undefined input', () => {
      const result = parseFilterParams(undefined);
      expect(result).to.deep.equal([]);
    });

    it('should skip invalid pairs without equals sign', () => {
      const input = 'tag=123,invalid,suite=456';
      const result = parseFilterParams(input);
      expect(result).to.deep.equal([
        { type: 'tag', id: '123' },
        { type: 'suite', id: '456' },
      ]);
    });

    it('should lowercase type', () => {
      const input = 'TAG=123';
      const result = parseFilterParams(input);
      expect(result).to.deep.equal([{ type: 'tag', id: '123' }]);
    });
  });

  describe('generateFilterRequestParams function', () => {
    it('should generate request params for valid input', () => {
      const input = { type: 'tag', id: '123', apiKey: 'myApiKey' };
      const result = generateFilterRequestParams(input);
      expect(result).to.deep.equal({
        params: {
          type: 'tag',
          id: '123',
          api_key: 'myApiKey',
        },
        responseType: 'json',
      });
    });

    it('should handle empty type correctly', () => {
      const input = { type: '', id: '123', apiKey: 'myApiKey' };
      const result = generateFilterRequestParams(input);
      expect(result).to.be.undefined;
    });

    it('should handle empty id correctly', () => {
      const input = { type: 'tag', id: '', apiKey: 'myApiKey' };
      const result = generateFilterRequestParams(input);
      expect(result).to.be.undefined;
    });

    it('should handle missing id correctly', () => {
      const input = { type: 'tag', apiKey: 'myApiKey' };
      const result = generateFilterRequestParams(input);
      expect(result).to.be.undefined;
    });
  });
});
