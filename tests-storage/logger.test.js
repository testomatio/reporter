const { logger, log, step } = require('../lib/reporter');
const { expect } = require('chai');
const fs = require('fs');
const path = require('path');
const { TESTOMAT_TMP_STORAGE } = require('../lib/constants');
const { fileSystem, removeColorCodes } = require('../lib/util');

const pinoLogger = require('pino')();

describe('Logger', () => {
  it('logger is defined', () => {
    expect(logger).to.exist;
  });

  before(() => {
    fileSystem.clearDir(TESTOMAT_TMP_STORAGE.mainDir + '/log');
  });

  describe('Console log methods', () => {
    it('intercept console.log @T00000000', () => {
      const message = 'test log message';
      console.log(message);
      const logFilePath = path.join(TESTOMAT_TMP_STORAGE.mainDir, 'log', 'log_00000000');
      expect(fs.existsSync(logFilePath)).to.equal(true);
      const logContent = removeColorCodes(fs.readFileSync(logFilePath, 'utf8'));
      expect(logContent).to.equal(`${message}\n`);
    });

    it('intercept console.warn @T00000001', () => {
      const message = 'test warn message';
      console.warn(message);
      const logFilePath = path.join(TESTOMAT_TMP_STORAGE.mainDir, 'log', 'log_00000001');
      expect(fs.existsSync(logFilePath)).to.equal(true);
      const logContent = removeColorCodes(fs.readFileSync(logFilePath, 'utf8'));
      expect(logContent).to.equal(`${message}\n`);
    });

    it('intercept console.error @T00000002', () => {
      const message = 'test error message';
      console.error(message);
      const logFilePath = path.join(TESTOMAT_TMP_STORAGE.mainDir, 'log', 'log_00000002');
      expect(fs.existsSync(logFilePath)).to.equal(true);
      const logContent = removeColorCodes(fs.readFileSync(logFilePath, 'utf8'));
      expect(logContent).to.equal(`${message}\n`);
    });

    it('intercept console.info @T00000003', () => {
      const message = 'test info message';
      console.info(message);
      const logFilePath = path.join(TESTOMAT_TMP_STORAGE.mainDir, 'log', 'log_00000003');
      expect(fs.existsSync(logFilePath)).to.equal(true);
      const logContent = removeColorCodes(fs.readFileSync(logFilePath, 'utf8'));
      expect(logContent).to.equal(`${message}\n`);
    });

    it('intercept console.debug @T00000004', () => {
      const message = 'test debug message';
      console.debug(message);
      const logFilePath = path.join(TESTOMAT_TMP_STORAGE.mainDir, 'log', 'log_00000004');
      expect(fs.existsSync(logFilePath)).to.equal(true);
      const logContent = removeColorCodes(fs.readFileSync(logFilePath, 'utf8'));
      expect(logContent).to.equal(`${message}\n`);
    });

    it.skip('intercept console.trace @T00000005', () => {
      const message = 'test trace message';
      console.trace(message);
      const logFilePath = path.join(TESTOMAT_TMP_STORAGE.mainDir, 'log', 'log_00000005');
      expect(fs.existsSync(logFilePath)).to.equal(true);
      const logContent = removeColorCodes(fs.readFileSync(logFilePath, 'utf8'));
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
      const logContent = removeColorCodes(fs.readFileSync(logFilePath, 'utf8'));
      expect(logContent).to.include(`${message}\n`);
    });
  });

  describe('Configuration', () => {
    it('logger could be configured @T00000007', () => {
      logger.configure({ logLevel: 'warn', prettyObjects: false });

      expect(logger.prettyObjects).to.equal(false);
      expect(logger.logLevel).to.equal('WARN');
    });

    it('logger intercepts messages according to log level @T00000012', () => {
      logger.configure({ logLevel: 'warn' });
      const infoMessage = 'this is info message';
      const warnMessage = 'this is warn message';
      const errorMessage = 'this is error message';

      console.info(infoMessage);
      console.warn(warnMessage);
      console.error(errorMessage);
      const logFilePath = path.join(TESTOMAT_TMP_STORAGE.mainDir, 'log', 'log_00000012');
      const logContent = removeColorCodes(fs.readFileSync(logFilePath, 'utf8'));
      expect(logContent).to.equal(`${warnMessage}\n${errorMessage}\n`);
    });
  });

  it('log step @T00000008', () => {
    const message = 'test step message';
    step(message);
    const logFilePath = path.join(TESTOMAT_TMP_STORAGE.mainDir, 'log', 'log_00000008');
    expect(fs.existsSync(logFilePath)).to.equal(true);
    const logContent = removeColorCodes(fs.readFileSync(logFilePath, 'utf8'));
    expect(logContent).to.equal(`> ${message}\n`);
  });

  describe('Template literals', () => {
    it('tagged template @T00000009', () => {
      const message = 'tagged template message';
      log`tagged template message`;
      const logFilePath = path.join(TESTOMAT_TMP_STORAGE.mainDir, 'log', 'log_00000009');
      expect(fs.existsSync(logFilePath)).to.equal(true);
      const logContent = removeColorCodes(fs.readFileSync(logFilePath, 'utf8'));
      expect(logContent).to.equal(`${message}\n`);
    });

    it('standard template string with variable @T00000010', () => {
      const message = 'standard template message';
      const someVar = 'variable value';
      log`standard template message ${someVar}`;
      const logFilePath = path.join(TESTOMAT_TMP_STORAGE.mainDir, 'log', 'log_00000010');
      expect(fs.existsSync(logFilePath)).to.equal(true);
      const logContent = removeColorCodes(fs.readFileSync(logFilePath, 'utf8'));
      expect(logContent).to.equal(`${message} ${someVar}\n`);
    });

    it('standard with multiple variables @T00000011', () => {
      const message = 'standard message';
      const someVar = 'variable value';
      const someVar2 = 'variable value2';
      log(message, someVar, someVar2);
      const logFilePath = path.join(TESTOMAT_TMP_STORAGE.mainDir, 'log', 'log_00000011');
      expect(fs.existsSync(logFilePath)).to.equal(true);
      const logContent = removeColorCodes(fs.readFileSync(logFilePath, 'utf8'));
      expect(logContent).to.equal(`${message} ${someVar} ${someVar2}\n`);
    });
  });

  it('get logs from file @T00000016', () => {
    const message = 'test log message';
    logger.log(message);
    const logFilePath = path.join(TESTOMAT_TMP_STORAGE.mainDir, 'log', 'log_00000016');
    expect(fs.existsSync(logFilePath)).to.equal(true);
    const logs = removeColorCodes(logger.getLogs('@T00000016'));
    expect(logs).to.equal(`${message}\n`);
  });

  // TODO
  it.skip('get logs from global var @T00000014', () => {
    const message = 'test log message';
    console.log(message);
    const logs = removeColorCodes(logger.getLogs());
    expect(logs).to.equal(`${message}\n`);
  });

  it('intercept logger.log message @T00000015', () => {
    const message = 'test log message';
    logger.log(message);
    const logFilePath = path.join(TESTOMAT_TMP_STORAGE.mainDir, 'log', 'log_00000015');
    expect(fs.existsSync(logFilePath)).to.equal(true);
    const logContent = removeColorCodes(fs.readFileSync(logFilePath, 'utf8'));
    expect(logContent).to.equal(`${message}\n`);
  });
});

module.exports.removeColorCodes = removeColorCodes;
