const { expect } = require('chai');
const { parseFilterParams, updateFilterType, generateFilterRequestParams } = require('../../lib/utils/pipe_utils');

describe('testing ipe/misc.js functions', () => {
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
            expect(result).to.deep.equal({ type: undefined, id: 'abc' });
        });

        it('should handle undefined input correctly', () => {
            const result = parseFilterParams("plan-id=");
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
                    api_key: 'myApiKey'
                },
                responseType: 'json'
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