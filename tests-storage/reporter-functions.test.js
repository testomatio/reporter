const { expect } = require('chai');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { TESTOMAT_TMP_STORAGE_DIR } = require('../lib/constants');
const { fileSystem, removeColorCodes } = require('../lib/utils/utils');
const testomat = require('../lib/reporter');
const { keyValueStorage } = require('../lib/services/key-values');
const { dataStorage, stringToMD5Hash } = require('../lib/data-storage');

describe('Testomat reporter functions', () => {
  before(() => {
    fileSystem.clearDir(TESTOMAT_TMP_STORAGE_DIR);
  });

  it('step using testomat.step function @T00000018', () => {
    const message = 'test step message';
    dataStorage.setContext('@T00000018');
    testomat.step(message);
    const contextHash = stringToMD5Hash('@T00000018');
    const logFilePath = path.join(TESTOMAT_TMP_STORAGE_DIR, 'log', `log_${contextHash}`);
    expect(fs.existsSync(logFilePath)).to.equal(true);
    const logContent = removeColorCodes(fs.readFileSync(logFilePath, 'utf8'));
    expect(logContent).to.equal(`> ${message}`);
  });

  it('set key value pair using testomat functions @T00000019', () => {
    const keyValue = {
      browser: 'chrome',
    };
    dataStorage.setContext('@T00000019');
    testomat.meta(keyValue);
    const contextHash = stringToMD5Hash('@T00000019');
    const filePath = path.join(TESTOMAT_TMP_STORAGE_DIR, 'keyvalue', `keyvalue_${contextHash}`);
    expect(fs.existsSync(filePath)).to.equal(true);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    expect(fileContent).to.equal(JSON.stringify(keyValue));
  });

  it('set multiple key value pairs using testomat functions @T00000020', () => {
    const keyValue = {
      browser: 'chrome',
      os: 'mac',
      runType: 'regression',
    };
    const keyValue2 = {
      browser: 'firefox',
      os: 'windows',
      runType: 'smoke',
    };
    dataStorage.setContext('@T00000020');
    testomat.meta(keyValue);
    testomat.meta(keyValue2);
    const contextHash = stringToMD5Hash('@T00000020');
    const filePath = path.join(TESTOMAT_TMP_STORAGE_DIR, 'keyvalue', `keyvalue_${contextHash}`);
    expect(fs.existsSync(filePath)).to.equal(true);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    expect(fileContent).to.equal(JSON.stringify(keyValue) + os.EOL + JSON.stringify(keyValue2));
  });

  it('get key value pairs using testomat functions @T00000021', () => {
    const keyValue = {
      browser: 'chrome',
      os: 'mac',
      runType: 'regression',
    };
    const keyValue2 = {
      browser: 'firefox',
      os: 'windows',
      runType: 'smoke',
    };
    dataStorage.setContext('get key value pairs using testomat functions @T00000021');
    testomat.meta(keyValue);
    testomat.meta(keyValue2);
    const retrievedKeyValue = keyValueStorage.get('get key value pairs using testomat functions @T00000021');
    expect(retrievedKeyValue).to.deep.equal({ ...keyValue, ...keyValue2 });
  });
});
