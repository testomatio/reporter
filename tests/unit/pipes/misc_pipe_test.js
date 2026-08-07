import { expect } from 'chai';
import {
  parseFilterParams,
  updateFilterType,
  generateFilterRequestParams,
  plannedTestsLabel,
} from '../../../src/utils/pipe_utils.js';

describe('testing utils/pipe_utils.js functions', () => {
  describe('updateFilterType function', () => {
    it('should return "tag" when input is "tag-name"', () => {
      const result = updateFilterType('tag-name');
      expect(result).to.equal('tag');
    });

    it('should return "plan" when input is "plan-id"', () => {
      const result = updateFilterType('plan-id');
      expect(result).to.equal('plan');
    });

    it('should return "label" when input is "label"', () => {
      const result = updateFilterType('label');
      expect(result).to.equal('label');
    });

    it('should return undefined when input is an unsupported type', () => {
      const result = updateFilterType('unsupported-type');
      expect(result).to.be.undefined;
    });

    it('should return undefined when input is an empty string', () => {
      const result = updateFilterType('');
      expect(result).to.be.undefined;
    });
  });

  describe('parseFilterParams function', () => {
    it('should parse "tag-name" input correctly', () => {
      const input = 'tag-name=123';
      const result = parseFilterParams(input);
      expect(result).to.deep.equal({ type: 'tag', id: '123' });
    });
    it('should parse "plan-id" input correctly', () => {
      const input = 'plan-id=456';
      const result = parseFilterParams(input);
      expect(result).to.deep.equal({ type: 'plan', id: '456' });
    });

    it('should parse "label" input correctly', () => {
      const input = 'label=789';
      const result = parseFilterParams(input);
      expect(result).to.deep.equal({ type: 'label', id: '789' });
    });

    it('should handle unsupported type correctly', () => {
      const input = 'unsupported-type=abc';
      const result = parseFilterParams(input);
      expect(result).to.be.undefined;
    });

    it('should handle undefined input correctly', () => {
      const result = parseFilterParams('plan-id=');
      expect(result).to.deep.equal({ type: 'plan', id: '' });
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

  describe('plannedTestsLabel function', () => {
    const suites = [{ test_id: 'S1' }, { test_id: 'S2' }, { test_id: 'S3' }];
    const tests = [{ test_id: 'T1' }, { test_id: 'T2' }];

    it('should prefer the tests count reported by the server', () => {
      expect(plannedTestsLabel(suites, 159)).to.equal('**159** tests planned');
    });

    it('should count suites as suites when the server reported no count', () => {
      expect(plannedTestsLabel(suites, undefined)).to.equal('**3** suites planned');
    });

    it('should count tests as tests when the server reported no count', () => {
      expect(plannedTestsLabel(tests, undefined)).to.equal('**2** tests planned');
    });

    it('should report tests and suites separately when both are scheduled', () => {
      expect(plannedTestsLabel([...tests, ...suites], undefined)).to.equal('**2** tests and **3** suites planned');
    });

    it('should ignore a zero tests count reported by the server', () => {
      expect(plannedTestsLabel(suites, 0)).to.equal('**3** suites planned');
    });

    it('should treat tests without an id as tests', () => {
      expect(plannedTestsLabel([{ title: 'no id' }], undefined)).to.equal('**1** tests planned');
    });
  });
});
