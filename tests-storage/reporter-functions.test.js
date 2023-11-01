const { expect } = require('chai');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { TESTOMAT_TMP_STORAGE_DIR } = require('../lib/constants');
const { fileSystem, removeColorCodes } = require('../lib/util');
const { testomat } = require('../lib/reporter');
const keyValueStorage = require('../lib/storages/key-value-storage');

describe('Testomat reporter functions', () => {
  before(() => {
    fileSystem.clearDir(TESTOMAT_TMP_STORAGE_DIR);
  });

  it('step using testomat.step function @T00000018', () => {
    const message = 'test step message';
    testomat.step(message);
    const logFilePath = path.join(TESTOMAT_TMP_STORAGE_DIR, 'log', 'log_00000018');
    expect(fs.existsSync(logFilePath)).to.equal(true);
    const logContent = removeColorCodes(fs.readFileSync(logFilePath, 'utf8'));
    expect(logContent).to.equal(`> ${message}`);
  });

  it('set key value pair using testomat functions @T00000019', () => {
    const keyValue = {
      browser: 'chrome',
    };
    testomat.meta(keyValue);
    const filePath = path.join(TESTOMAT_TMP_STORAGE_DIR, 'keyvalue', 'keyvalue_00000019');
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

    testomat.meta(keyValue);
    testomat.meta(keyValue2);
    const filePath = path.join(TESTOMAT_TMP_STORAGE_DIR, 'keyvalue', 'keyvalue_00000020');
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

    testomat.meta(keyValue);
    testomat.meta(keyValue2);
    const retrievedKeyValue = keyValueStorage.get('@T00000021');
    expect(retrievedKeyValue).to.deep.equal({ ...keyValue, ...keyValue2 });
  });
});
