import { expect } from 'chai';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { TESTOMAT_TMP_STORAGE_DIR } from '../lib/constants.js';
import { fileSystem, removeColorCodes } from '../lib/utils/utils.js';
import testomat from '../lib/reporter.js';
import { keyValueStorage } from '../lib/services/key-values.js';
import { labelStorage } from '../lib/services/labels.js';
import { linkStorage } from '../lib/services/links.js';
import { dataStorage, stringToMD5Hash } from '../lib/data-storage.js';

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

  it('set single label using testomat functions @T00000022', () => {
    dataStorage.setContext('@T00000022');
    testomat.label('smoke');
    const contextHash = stringToMD5Hash('@T00000022');
    const filePath = path.join(TESTOMAT_TMP_STORAGE_DIR, 'links', `links_${contextHash}`);
    expect(fs.existsSync(filePath)).to.equal(true);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    expect(fileContent).to.equal(JSON.stringify([{label: 'smoke'}]));
  });

  it('set multiple labels using testomat functions @T00000023', () => {
    dataStorage.setContext('@T00000023');
    testomat.label('smoke');    
    testomat.label('feature', 'login');
    const retrievedLinks = linkStorage.get('@T00000023');
    expect(retrievedLinks).to.deep.equal([{label: 'smoke'}, {label: 'feature:login'}]);
  });

  it('set single test link using testomat.linkTest function @T00000024', () => {
    dataStorage.setContext('@T00000024');
    testomat.linkTest('TEST-123');
    const contextHash = stringToMD5Hash('@T00000024');
    const filePath = path.join(TESTOMAT_TMP_STORAGE_DIR, 'links', `links_${contextHash}`);
    expect(fs.existsSync(filePath)).to.equal(true);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    expect(fileContent).to.equal(JSON.stringify([{test: 'TEST-123'}]));
  });

  it('set multiple test links using testomat.linkTest function @T00000025', () => {
    dataStorage.setContext('@T00000025');
    testomat.linkTest('TEST-123', 'TEST-456', 'TEST-789');
    const retrievedLinks = linkStorage.get('@T00000025');
    expect(retrievedLinks).to.deep.equal([
      {test: 'TEST-123'}, 
      {test: 'TEST-456'}, 
      {test: 'TEST-789'}
    ]);
  });

  it('mix labels and test links using testomat functions @T00000026', () => {
    dataStorage.setContext('@T00000026');
    testomat.label('smoke');
    testomat.linkTest('TEST-123');
    testomat.label('priority', 'high');
    testomat.linkTest('TEST-456');
    const retrievedLinks = linkStorage.get('@T00000026');
    expect(retrievedLinks).to.deep.equal([
      {label: 'smoke'},
      {test: 'TEST-123'},
      {label: 'priority:high'},
      {test: 'TEST-456'}
    ]);
  });

  it('deduplicate identical links @T00000027', () => {
    dataStorage.setContext('@T00000027');
    testomat.linkTest('TEST-123');
    testomat.linkTest('TEST-123'); // duplicate
    testomat.label('smoke');
    testomat.label('smoke'); // duplicate
    const retrievedLinks = linkStorage.get('@T00000027');
    expect(retrievedLinks).to.deep.equal([
      {test: 'TEST-123'},
      {label: 'smoke'}
    ]);
  });
});
