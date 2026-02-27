import { expect } from 'chai';
import { log, info, warn, error, LOG_LEVELS } from '../../src/utils/log.js';

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
