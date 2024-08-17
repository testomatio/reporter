import { expect } from 'chai';
import TestomatioClient from '../lib/client.js';
import errorFn from './data/src/error.js';
const ANSI_REGEX = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;

describe('Client', () => {
  afterEach(() => {
    process.env.TESTOMATIO_STACK_IGNORE = null;
  });

  it('should include filter for stack trace', () => {
    const client = new TestomatioClient();

    let error = new Error('Test error');
    let stack = client.formatError(error);
    expect(stack).to.include('client_test.js');

    process.env.TESTOMATIO_STACK_IGNORE = '**/client_test.js';

    error = new Error('Test error');
    stack = client.formatError(error);
    expect(stack).not.to.include('client_test.js');

    try {
      process.env.TESTOMATIO_STACK_IGNORE = null;
      errorFn();
      expect.fail('Should throw error');
    } catch (e) {
      stack = client.formatError(e);
      // prettier-ignore
      expect(stack.replace(ANSI_REGEX, '')).to.include('throw new Error(\'Test error\')');
      expect(stack).to.include('data/src/error.js');
      expect(stack).to.include('client_test.js');
    }

    try {
      process.env.TESTOMATIO_STACK_IGNORE = '**/src/error.js';
      errorFn();
      expect.fail('Should throw error');
    } catch (e) {
      stack = client.formatError(e);

      // prettier-ignore
      expect(stack).not.to.include('throw new Error(\'Test error\')');
      expect(stack).not.to.include('data/src/error.js');
      expect(stack).to.include('client_test.js');
    }
  });
});
