const { logger, log, step } = require('../lib/reporter');
const { expect } = require('chai');
const fs = require('fs');
const path = require('path');
const { TESTOMAT_TMP_STORAGE } = require('../lib/constants');
const { fileSystem } = require('../lib/util');

// import { winston } from 'winston';
// const winston = require('winston');
const pinoLogger = require('pino')();

/**
 * Used to remove color codes
 * @param {*} input
 * @returns
 */
function removeANSIEscapeCodes(input) {
  return input.replace(/\u001b\[[0-9;]*m/g, '');
}

describe('Logger', () => {
  it('logger is defined', () => {
    expect(logger).to.exist;
  });

  before(() => {
    fileSystem.clearDir(TESTOMAT_TMP_STORAGE.mainDir);
  });

  describe('Log methods', () => {
    it('intercept console.log @T00000000', () => {
      const message = 'test log message';
      console.log(message);
      const logFilePath = path.join(TESTOMAT_TMP_STORAGE.mainDir, 'log', 'log_00000000');
      expect(fs.existsSync(logFilePath)).to.equal(true);
      const logContent = removeANSIEscapeCodes(fs.readFileSync(logFilePath, 'utf8'));
      expect(logContent).to.equal(`${message}\n`);
    });

    it('intercept console.warn @T00000001', () => {
      const message = 'test warn message';
      console.warn(message);
      const logFilePath = path.join(TESTOMAT_TMP_STORAGE.mainDir, 'log', 'log_00000001');
      expect(fs.existsSync(logFilePath)).to.equal(true);
      const logContent = removeANSIEscapeCodes(fs.readFileSync(logFilePath, 'utf8'));
      expect(logContent).to.equal(`${message}\n`);
    });

    it('intercept console.error @T00000002', () => {
      const message = 'test error message';
      console.error(message);
      const logFilePath = path.join(TESTOMAT_TMP_STORAGE.mainDir, 'log', 'log_00000002');
      expect(fs.existsSync(logFilePath)).to.equal(true);
      const logContent = removeANSIEscapeCodes(fs.readFileSync(logFilePath, 'utf8'));
      expect(logContent).to.equal(`${message}\n`);
    });

    it('intercept console.info @T00000003', () => {
      const message = 'test info message';
      console.info(message);
      const logFilePath = path.join(TESTOMAT_TMP_STORAGE.mainDir, 'log', 'log_00000003');
      expect(fs.existsSync(logFilePath)).to.equal(true);
      const logContent = removeANSIEscapeCodes(fs.readFileSync(logFilePath, 'utf8'));
      expect(logContent).to.equal(`${message}\n`);
    });

    it('intercept console.debug @T00000004', () => {
      const message = 'test debug message';
      console.debug(message);
      const logFilePath = path.join(TESTOMAT_TMP_STORAGE.mainDir, 'log', 'log_00000004');
      expect(fs.existsSync(logFilePath)).to.equal(true);
      const logContent = removeANSIEscapeCodes(fs.readFileSync(logFilePath, 'utf8'));
      expect(logContent).to.equal(`${message}\n`);
    });

    it('intercept console.trace @T00000005', () => {
      const message = 'test trace message';
      console.trace(message);
      const logFilePath = path.join(TESTOMAT_TMP_STORAGE.mainDir, 'log', 'log_00000005');
      expect(fs.existsSync(logFilePath)).to.equal(true);
      const logContent = removeANSIEscapeCodes(fs.readFileSync(logFilePath, 'utf8'));
      expect(logContent).to.include(`${message}\n`);
    });
  });

  describe('External loggers', () => {
    it('pino log @T00000006', () => {
      logger.intercept(pinoLogger);

      const message = 'pino logger message';
      pinoLogger.warn(message);

      const logFilePath = path.join(TESTOMAT_TMP_STORAGE.mainDir, 'log', 'log_00000006');
      expect(fs.existsSync(logFilePath)).to.equal(true, 'log file does not exist');
      const logContent = removeANSIEscapeCodes(fs.readFileSync(logFilePath, 'utf8'));
      expect(logContent).to.include(`${message}\n`);
    });
  });

  describe('Frameworks', () => {
    it('logger could be configured @T00000007', () => {
      logger.configure({ logLevel: 'warn', prettyObjects: false });

      expect(logger.prettyObjects).to.equal(false);
      expect(logger.logLevel).to.equal('WARN');
    });
  });

  it('log step @T00000008', () => {
    const message = 'test step message';
    step(message);
    const logFilePath = path.join(TESTOMAT_TMP_STORAGE.mainDir, 'log', 'log_00000008');
    expect(fs.existsSync(logFilePath)).to.equal(true);
    const logContent = removeANSIEscapeCodes(fs.readFileSync(logFilePath, 'utf8'));
    expect(logContent).to.equal(`${message}\n`);
  });

  describe.only('Log template literals', () => {
    it('tagged template @T00000009', () => {
      const message = 'tagged template message';
      log`tagged template message`;
      const logFilePath = path.join(TESTOMAT_TMP_STORAGE.mainDir, 'log', 'log_00000009');
      expect(fs.existsSync(logFilePath)).to.equal(true);
      const logContent = removeANSIEscapeCodes(fs.readFileSync(logFilePath, 'utf8'));
      expect(logContent).to.equal(`${message}\n`);
    });

    it('standard template string with variable @T00000010', () => {
      const message = 'standard template message';
      const someVar = 'variable value';
      log`standard template message ${someVar}`;
      const logFilePath = path.join(TESTOMAT_TMP_STORAGE.mainDir, 'log', 'log_00000010');
      expect(fs.existsSync(logFilePath)).to.equal(true);
      const logContent = removeANSIEscapeCodes(fs.readFileSync(logFilePath, 'utf8'));
      expect(logContent).to.equal(`${message} ${someVar}\n`);
    });

    it('standard with multiple variables @T00000011', () => {
      const message = 'standard message';
      const someVar = 'variable value';
      const someVar2 = 'variable value2';
      log(message, someVar, someVar2);
      const logFilePath = path.join(TESTOMAT_TMP_STORAGE.mainDir, 'log', 'log_00000011');
      expect(fs.existsSync(logFilePath)).to.equal(true);
      const logContent = removeANSIEscapeCodes(fs.readFileSync(logFilePath, 'utf8'));
      expect(logContent).to.equal(`${message} ${someVar} ${someVar2}\n`);
    });
  });
});

// it('log', () => {
//   expect(logger).to.exist;
// });
// it('step', () => {
//   expect(logger).to.exist;
// });
