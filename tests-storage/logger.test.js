const { step, log } = require('../lib/reporter');
const { expect } = require('chai');
const fs = require('fs');
const path = require('path');
const { TESTOMAT_TMP_STORAGE_DIR } = require('../lib/constants');
const { fileSystem, removeColorCodes } = require('../lib/utils/utils');
const testomat = require('../lib/reporter');
const { logger } = require('../lib/services/logger');
const { dataStorage, stringToMD5Hash } = require('../lib/data-storage');

const pinoLogger = require('pino')();

describe('Logger', () => {
  it('logger is defined', () => {
    expect(logger).to.exist;
  });

  before(() => {
    fileSystem.clearDir(TESTOMAT_TMP_STORAGE_DIR + '/log');
  });

  describe('Console log methods', () => {
    it('intercept console.log @T00000000', () => {
      dataStorage.setContext('intercept console.log @T00000000');
      const message = 'test log message';
      console.log(message);
      const contextHash = stringToMD5Hash('intercept console.log @T00000000');
      const logFilePath = path.join(TESTOMAT_TMP_STORAGE_DIR, 'log', `log_${contextHash}`);
      expect(fs.existsSync(logFilePath)).to.equal(true);
      const logContent = removeColorCodes(fs.readFileSync(logFilePath, 'utf8'));
      expect(logContent).to.equal(`${message}`);
    });

    it('intercept console.warn @T00000001', () => {
      dataStorage.setContext('intercept console.warn @T00000001');
      const message = 'test warn message';
      console.warn(message);
      const contextHash = stringToMD5Hash('intercept console.warn @T00000001');
      const logFilePath = path.join(TESTOMAT_TMP_STORAGE_DIR, 'log', `log_${contextHash}`);
      expect(fs.existsSync(logFilePath)).to.equal(true);
      const logContent = removeColorCodes(fs.readFileSync(logFilePath, 'utf8'));
      expect(logContent).to.equal(`${message}`);
    });

    it('intercept console.error @T00000002', () => {
      dataStorage.setContext('intercept console.error @T00000002');
      const message = 'test error message';
      console.error(message);
      const contextHash = stringToMD5Hash('intercept console.error @T00000002');
      const logFilePath = path.join(TESTOMAT_TMP_STORAGE_DIR, 'log', `log_${contextHash}`);
      expect(fs.existsSync(logFilePath)).to.equal(true);
      const logContent = removeColorCodes(fs.readFileSync(logFilePath, 'utf8'));
      expect(logContent).to.equal(`${message}`);
    });

    it('intercept console.info @T00000003', () => {
      dataStorage.setContext('intercept console.info @T00000003');
      const message = 'test info message';
      console.info(message);
      const contextHash = stringToMD5Hash('intercept console.info @T00000003');
      const logFilePath = path.join(TESTOMAT_TMP_STORAGE_DIR, 'log', `log_${contextHash}`);
      expect(fs.existsSync(logFilePath)).to.equal(true);
      const logContent = removeColorCodes(fs.readFileSync(logFilePath, 'utf8'));
      expect(logContent).to.equal(`${message}`);
    });

    it('intercept console.debug @T00000004', () => {
      dataStorage.setContext('intercept console.debug @T00000004');
      const message = 'test debug message';
      console.debug(message);
      const contextHash = stringToMD5Hash('intercept console.debug @T00000004');
      const logFilePath = path.join(TESTOMAT_TMP_STORAGE_DIR, 'log', `log_${contextHash}`);
      expect(fs.existsSync(logFilePath)).to.equal(true);
      const logContent = removeColorCodes(fs.readFileSync(logFilePath, 'utf8'));
      expect(logContent).to.equal(`${message}`);
    });

    it.skip('intercept console.trace @T00000005', () => {
      dataStorage.setContext('@T00000005');
      const message = 'test trace message';
      console.trace(message);
      const logFilePath = path.join(TESTOMAT_TMP_STORAGE_DIR, 'log', 'log_T00000005');
      expect(fs.existsSync(logFilePath)).to.equal(true);
      const logContent = removeColorCodes(fs.readFileSync(logFilePath, 'utf8'));
      expect(logContent).to.include(`${message}`);
    });
  });

  describe('External loggers', () => {
    it('pino log @T00000006', () => {
      dataStorage.setContext('pino log @T00000006');
      logger.intercept(pinoLogger);

      const message = 'pino logger message';
      pinoLogger.warn(message);

      const contextHash = stringToMD5Hash('pino log @T00000006');
      const logFilePath = path.join(TESTOMAT_TMP_STORAGE_DIR, 'log', `log_${contextHash}`);
      expect(fs.existsSync(logFilePath)).to.equal(true, 'log file does not exist');
      const logContent = removeColorCodes(fs.readFileSync(logFilePath, 'utf8'));
      expect(logContent).to.include(`${message}`);

      // postcondition - intercept console
      logger.intercept(console);
    });
  });

  describe('Configuration', () => {
    it('logger could be configured @T00000007', () => {
      logger.configure({ logLevel: 'warn', prettyObjects: false });

      expect(logger.prettyObjects).to.equal(false);
      expect(logger.logLevel).to.equal('WARN');

      // reset settings
      logger.configure({ logLevel: 'DEBUG', prettyObjects: true });
    });

    it('logger intercepts messages according to log level @T00000012', () => {
      dataStorage.setContext('@T00000012');
      logger.configure({ logLevel: 'warn' });
      const infoMessage = 'this is info message';
      const warnMessage = 'this is warn message';
      const errorMessage = 'this is error message';

      console.info(infoMessage);
      console.warn(warnMessage);
      console.error(errorMessage);

      const contextHash = stringToMD5Hash('@T00000012');
      const logFilePath = path.join(TESTOMAT_TMP_STORAGE_DIR, 'log', `log_${contextHash}`);
      const logContent = removeColorCodes(fs.readFileSync(logFilePath, 'utf8'));
      expect(logContent).to.equal(`${warnMessage}\n${errorMessage}`);

      // reset settings
      logger.configure({ logLevel: 'DEBUG' });
    });
  });

  it('log step @T00000008', () => {
    dataStorage.setContext('@T00000008');
    const message = 'test step message';
    step(message);
    const contextHash = stringToMD5Hash('@T00000008');
    const logFilePath = path.join(TESTOMAT_TMP_STORAGE_DIR, 'log', `log_${contextHash}`);
    expect(fs.existsSync(logFilePath)).to.equal(true);
    const logContent = removeColorCodes(fs.readFileSync(logFilePath, 'utf8'));
    expect(logContent).to.equal(`> ${message}`);
  });

  describe('Template literals', () => {
    it('tagged template @T00000009', () => {
      dataStorage.setContext('@T00000009');
      const message = 'tagged template message';
      log`tagged template message`;
      const contextHash = stringToMD5Hash('@T00000009');
      const logFilePath = path.join(TESTOMAT_TMP_STORAGE_DIR, 'log', `log_${contextHash}`);
      expect(fs.existsSync(logFilePath)).to.equal(true);
      const logContent = removeColorCodes(fs.readFileSync(logFilePath, 'utf8'));
      expect(logContent).to.equal(`${message}`);
    });

    it('standard template string with variable @T00000010', () => {
      dataStorage.setContext('@T00000010');
      const message = 'standard template message';
      const someVar = 'variable value';
      log`standard template message ${someVar}`;
      const contextHash = stringToMD5Hash('@T00000010');
      const logFilePath = path.join(TESTOMAT_TMP_STORAGE_DIR, 'log', `log_${contextHash}`);
      expect(fs.existsSync(logFilePath)).to.equal(true);
      const logContent = removeColorCodes(fs.readFileSync(logFilePath, 'utf8'));
      expect(logContent).to.equal(`${message} ${someVar}`);
    });

    it('standard with multiple variables @T00000011', () => {
      dataStorage.setContext('@T00000011');
      const message = 'standard message';
      const someVar = 'variable value';
      const someVar2 = 'variable value2';
      log(message, someVar, someVar2);
      const contextHash = stringToMD5Hash('@T00000011');
      const logFilePath = path.join(TESTOMAT_TMP_STORAGE_DIR, 'log', `log_${contextHash}`);
      expect(fs.existsSync(logFilePath)).to.equal(true);
      const logContent = removeColorCodes(fs.readFileSync(logFilePath, 'utf8'));
      expect(logContent).to.equal(`${message} ${someVar} ${someVar2}`);
    });
  });

  it('get logs from file @T00000016', () => {
    dataStorage.setContext('@T00000016');
    const message = 'test log message';
    testomat.log(message);
    const contextHash = stringToMD5Hash('@T00000016');
    const logFilePath = path.join(TESTOMAT_TMP_STORAGE_DIR, 'log', `log_${contextHash}`);
    expect(fs.existsSync(logFilePath)).to.equal(true);
    const logs = removeColorCodes(logger.getLogs('@T00000016').join('\n'));
    expect(logs).to.equal(`${message}`);
  });

  // TODO
  it.skip('get logs from global var @T00000014', () => {
    const message = 'test log message';
    console.log(message);
    const logs = removeColorCodes(logger.getLogs().join('\n'));
    expect(logs).to.equal(`${message}`);
  });

  it('intercept logger.log message @T00000015', () => {
    dataStorage.setContext('@T00000015');
    const message = 'test log message';
    testomat.log(message);
    const contextHash = stringToMD5Hash('@T00000015');
    const logFilePath = path.join(TESTOMAT_TMP_STORAGE_DIR, 'log', `log_${contextHash}`);
    expect(fs.existsSync(logFilePath)).to.equal(true);
    const logContent = removeColorCodes(fs.readFileSync(logFilePath, 'utf8'));
    expect(logContent).to.equal(`${message}`);
  });

  it('log using testomat.log function @T00000017', () => {
    dataStorage.setContext('@T00000017');
    const message = 'test log message';
    testomat.log(message);
    const contextHash = stringToMD5Hash('@T00000017');
    const logFilePath = path.join(TESTOMAT_TMP_STORAGE_DIR, 'log', `log_${contextHash}`);
    expect(fs.existsSync(logFilePath)).to.equal(true);
    const logContent = removeColorCodes(fs.readFileSync(logFilePath, 'utf8'));
    expect(logContent).to.equal(`${message}`);
  });

  it('stop/restore intercetion @T00000019', () => {
    dataStorage.setContext('@T00000019');
    console.log('message 1');
    logger.stopInterception();
    console.log('message 2');
    logger.intercept(console);
    console.log('message 3');
    const contextHash = stringToMD5Hash('@T00000019');
    const logFilePath = path.join(TESTOMAT_TMP_STORAGE_DIR, 'log', `log_${contextHash}`);
    expect(fs.existsSync(logFilePath)).to.equal(true);
    const logContent = removeColorCodes(fs.readFileSync(logFilePath, 'utf8'));
    expect(logContent).to.include('message 1\nmessage 3');
  });
});

module.exports.removeColorCodes = removeColorCodes;

// TODO: test for reinterception (intercept console, then intercept pino, then intercept console again)
