import { expect } from 'chai';
import pc from 'picocolors';
import { log, info, warn, error, errorWithFields, LOG_LEVELS } from '../../src/utils/log.js';

describe('Logger Utility', () => {
  let originalEnv;

  beforeEach(() => {
    // Save original env and clear TESTOMATIO_LOG_LEVEL
    originalEnv = process.env.TESTOMATIO_LOG_LEVEL;
    delete process.env.TESTOMATIO_LOG_LEVEL;
  });

  afterEach(() => {
    // Restore original env
    if (originalEnv !== undefined) {
      process.env.TESTOMATIO_LOG_LEVEL = originalEnv;
    } else {
      delete process.env.TESTOMATIO_LOG_LEVEL;
    }
  });

  describe('getLogLevel()', () => {
    it('should return INFO level (2) when no env var is set', () => {
      expect(log.getLogLevel()).to.equal(LOG_LEVELS.INFO);
    });

    it('should return ERROR (0) when TESTOMATIO_LOG_LEVEL=ERROR', () => {
      process.env.TESTOMATIO_LOG_LEVEL = 'ERROR';
      expect(log.getLogLevel()).to.equal(LOG_LEVELS.ERROR);
    });

    it('should return WARN (1) when TESTOMATIO_LOG_LEVEL=WARN', () => {
      process.env.TESTOMATIO_LOG_LEVEL = 'WARN';
      expect(log.getLogLevel()).to.equal(LOG_LEVELS.WARN);
    });

    it('should return INFO (2) when TESTOMATIO_LOG_LEVEL=INFO', () => {
      process.env.TESTOMATIO_LOG_LEVEL = 'INFO';
      expect(log.getLogLevel()).to.equal(LOG_LEVELS.INFO);
    });

    it('should handle lowercase env var values', () => {
      process.env.TESTOMATIO_LOG_LEVEL = 'error';
      expect(log.getLogLevel()).to.equal(LOG_LEVELS.ERROR);
    });

    it('should return INFO level for invalid env var values', () => {
      process.env.TESTOMATIO_LOG_LEVEL = 'INVALID';
      expect(log.getLogLevel()).to.equal(LOG_LEVELS.INFO);
    });
  });

  describe('shouldLog()', () => {
    it('should return false for INFO message when log level is ERROR', () => {
      process.env.TESTOMATIO_LOG_LEVEL = 'ERROR';
      expect(log.shouldLog(LOG_LEVELS.INFO)).to.be.false;
    });

    it('should return true for ERROR message when log level is ERROR', () => {
      process.env.TESTOMATIO_LOG_LEVEL = 'ERROR';
      expect(log.shouldLog(LOG_LEVELS.ERROR)).to.be.true;
    });

    it('should return false for INFO message when log level is WARN', () => {
      process.env.TESTOMATIO_LOG_LEVEL = 'WARN';
      expect(log.shouldLog(LOG_LEVELS.INFO)).to.be.false;
    });

    it('should return true for WARN message when log level is WARN', () => {
      process.env.TESTOMATIO_LOG_LEVEL = 'WARN';
      expect(log.shouldLog(LOG_LEVELS.WARN)).to.be.true;
    });

    it('should return true for ERROR message when log level is WARN', () => {
      process.env.TESTOMATIO_LOG_LEVEL = 'WARN';
      expect(log.shouldLog(LOG_LEVELS.ERROR)).to.be.true;
    });
  });

  describe('info() - INFO level messages', () => {
    it('should not log when TESTOMATIO_LOG_LEVEL=WARN', () => {
      process.env.TESTOMATIO_LOG_LEVEL = 'WARN';
      const spy = new Proxy(console, {
        get(target, prop) {
          if (prop === 'log') {
            return () => {
              throw new Error('console.log should not be called');
            };
          }
          return target[prop];
        },
      });
      const originalLog = console.log;
      console.log = spy.log;

      expect(() => info('test message')).to.not.throw();
      console.log = originalLog;
    });

    it('should not log when TESTOMATIO_LOG_LEVEL=ERROR', () => {
      process.env.TESTOMATIO_LOG_LEVEL = 'ERROR';
      const spy = new Proxy(console, {
        get(target, prop) {
          if (prop === 'log') {
            return () => {
              throw new Error('console.log should not be called');
            };
          }
          return target[prop];
        },
      });
      const originalLog = console.log;
      console.log = spy.log;

      expect(() => info('test message')).to.not.throw();
      console.log = originalLog;
    });

    it('should log when TESTOMATIO_LOG_LEVEL=INFO', () => {
      process.env.TESTOMATIO_LOG_LEVEL = 'INFO';
      const calls = [];
      const originalLog = console.log;
      console.log = (...args) => {
        calls.push(args);
      };

      info('test message');
      console.log = originalLog;

      expect(calls.length).to.equal(1);
      expect(calls[0][0]).to.include('[TESTOMATIO]');
      expect(calls[0][1]).to.equal('test message');
    });
  });

  describe('warn() - WARN level messages', () => {
    it('should not warn when TESTOMATIO_LOG_LEVEL=ERROR', () => {
      process.env.TESTOMATIO_LOG_LEVEL = 'ERROR';
      const spy = new Proxy(console, {
        get(target, prop) {
          if (prop === 'warn') {
            return () => {
              throw new Error('console.warn should not be called');
            };
          }
          return target[prop];
        },
      });
      const originalWarn = console.warn;
      console.warn = spy.warn;

      expect(() => warn('test message')).to.not.throw();
      console.warn = originalWarn;
    });

    it('should warn when TESTOMATIO_LOG_LEVEL=WARN', () => {
      process.env.TESTOMATIO_LOG_LEVEL = 'WARN';
      const calls = [];
      const originalWarn = console.warn;
      console.warn = (...args) => {
        calls.push(args);
      };

      warn('test message');
      console.warn = originalWarn;

      expect(calls.length).to.equal(1);
      expect(calls[0][0]).to.include('[TESTOMATIO]');
      expect(calls[0][1]).to.equal('test message');
    });

    it('should warn when TESTOMATIO_LOG_LEVEL=INFO', () => {
      process.env.TESTOMATIO_LOG_LEVEL = 'INFO';
      const calls = [];
      const originalWarn = console.warn;
      console.warn = (...args) => {
        calls.push(args);
      };

      warn('test message');
      console.warn = originalWarn;

      expect(calls.length).to.equal(1);
    });
  });

  describe('error() - ERROR level messages', () => {
    it('should error when TESTOMATIO_LOG_LEVEL=ERROR', () => {
      process.env.TESTOMATIO_LOG_LEVEL = 'ERROR';
      const calls = [];
      const originalError = console.error;
      console.error = (...args) => {
        calls.push(args);
      };

      error('test message');
      console.error = originalError;

      expect(calls.length).to.equal(1);
      expect(calls[0][0]).to.include('[TESTOMATIO]');
      expect(calls[0][1]).to.equal('test message');
    });

    it('should error when TESTOMATIO_LOG_LEVEL=WARN', () => {
      process.env.TESTOMATIO_LOG_LEVEL = 'WARN';
      const calls = [];
      const originalError = console.error;
      console.error = (...args) => {
        calls.push(args);
      };

      error('test message');
      console.error = originalError;

      expect(calls.length).to.equal(1);
    });

    it('should error when TESTOMATIO_LOG_LEVEL=INFO', () => {
      process.env.TESTOMATIO_LOG_LEVEL = 'INFO';
      const calls = [];
      const originalError = console.error;
      console.error = (...args) => {
        calls.push(args);
      };

      error('test message');
      console.error = originalError;

      expect(calls.length).to.equal(1);
    });
  });

  describe('JSON output (TESTOMATIO_LOG_JSON=1)', () => {
    let calls;
    let originalError;
    let originalWarn;

    beforeEach(() => {
      process.env.TESTOMATIO_LOG_JSON = '1';
      calls = [];
      originalError = console.error;
      originalWarn = console.warn;
      console.error = (...args) => calls.push(args);
      console.warn = (...args) => calls.push(args);
    });

    afterEach(() => {
      console.error = originalError;
      console.warn = originalWarn;
      delete process.env.TESTOMATIO_LOG_JSON;
    });

    it('prints errors as a single JSON object with level and message', () => {
      error('something went wrong');

      expect(calls.length).to.equal(1);
      expect(JSON.parse(calls[0][0])).to.deep.equal({ level: 'error', message: 'something went wrong' });
    });

    it('prints warnings as JSON and strips colors from the message', () => {
      warn(pc.yellow('be careful'));

      expect(JSON.parse(calls[0][0])).to.deep.equal({ level: 'warn', message: 'be careful' });
    });

    it('keeps the [TESTOMATIO] prefix out of the JSON output', () => {
      error('plain message');

      expect(calls[0][0]).to.not.include('[TESTOMATIO]');
    });

    it('formats multiple arguments into one message, as the text logger does', () => {
      error('failed:', { status: 403 });

      expect(JSON.parse(calls[0][0]).message).to.equal('failed: { status: 403 }');
    });

    it('adds structured fields of errorWithFields to the JSON object', () => {
      errorWithFields({ status: 403, url: 'https://app.testomat.io/api/reporter' }, 'Request failed');

      expect(JSON.parse(calls[0][0])).to.deep.equal({
        status: 403,
        url: 'https://app.testomat.io/api/reporter',
        level: 'error',
        message: 'Request failed',
      });
    });

    it('never lets a field override the log level', () => {
      errorWithFields({ level: 'info' }, 'still an error');

      expect(JSON.parse(calls[0][0]).level).to.equal('error');
    });

    it('prints prefixed text when JSON output is disabled', () => {
      delete process.env.TESTOMATIO_LOG_JSON;
      errorWithFields({ status: 403 }, 'Request failed');

      expect(calls[0][0]).to.include('[TESTOMATIO]');
      expect(calls[0][1]).to.equal('Request failed');
    });
  });

  describe('LOG_LEVELS constant', () => {
    it('should have all expected log levels', () => {
      expect(LOG_LEVELS).to.have.property('ERROR', 0);
      expect(LOG_LEVELS).to.have.property('WARN', 1);
      expect(LOG_LEVELS).to.have.property('INFO', 2);
    });

    it('should not have SILENT, LOG, or DEBUG levels', () => {
      expect(LOG_LEVELS).to.not.have.property('SILENT');
      expect(LOG_LEVELS).to.not.have.property('LOG');
      expect(LOG_LEVELS).to.not.have.property('DEBUG');
    });
  });
});
