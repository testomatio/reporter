import { expect } from 'chai';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { TESTOMAT_TMP_STORAGE_DIR } from '../lib/constants.js';
import { fileSystem, removeColorCodes } from '../lib/utils/utils.js';
import testomat from '../lib/reporter.js';
import { keyValueStorage } from '../lib/services/key-values.js';
import { labelStorage } from '../lib/services/labels.js';
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
    testomat.labels('smoke');
    const contextHash = stringToMD5Hash('@T00000022');
    const filePath = path.join(TESTOMAT_TMP_STORAGE_DIR, 'labels', `labels_${contextHash}`);
    expect(fs.existsSync(filePath)).to.equal(true);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    expect(fileContent).to.equal(JSON.stringify(['smoke']));
  });

  it('set multiple labels using testomat functions @T00000023', () => {
    dataStorage.setContext('@T00000023');
    testomat.labels('smoke', 'severity:high', 'feature:login');
    const contextHash = stringToMD5Hash('@T00000023');
    const filePath = path.join(TESTOMAT_TMP_STORAGE_DIR, 'labels', `labels_${contextHash}`);
    expect(fs.existsSync(filePath)).to.equal(true);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    expect(fileContent).to.equal(JSON.stringify(['smoke', 'severity:high', 'feature:login']));
  });

  it('set labels using array format @T00000024', () => {
    dataStorage.setContext('@T00000024');
    testomat.labels(['regression', 'priority:critical', 'team:qa']);
    const contextHash = stringToMD5Hash('@T00000024');
    const filePath = path.join(TESTOMAT_TMP_STORAGE_DIR, 'labels', `labels_${contextHash}`);
    expect(fs.existsSync(filePath)).to.equal(true);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    expect(fileContent).to.equal(JSON.stringify(['regression', 'priority:critical', 'team:qa']));
  });

  it('set labels with multiple calls @T00000025', () => {
    dataStorage.setContext('@T00000025');
    testomat.labels('smoke', 'severity:high');
    testomat.labels('feature:user_account');
    const contextHash = stringToMD5Hash('@T00000025');
    const filePath = path.join(TESTOMAT_TMP_STORAGE_DIR, 'labels', `labels_${contextHash}`);
    expect(fs.existsSync(filePath)).to.equal(true);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const lines = fileContent.trim().split(os.EOL);
    expect(lines[0]).to.equal(JSON.stringify(['smoke', 'severity:high']));
    expect(lines[1]).to.equal(JSON.stringify(['feature:user_account']));
  });

  it('get merged labels using testomat functions @T00000026', () => {
    dataStorage.setContext('get merged labels using testomat functions @T00000026');
    testomat.labels('smoke', 'severity:high');
    testomat.labels('feature:login', 'smoke'); // duplicate should be removed
    const retrievedLabels = labelStorage.get('get merged labels using testomat functions @T00000026');
    expect(retrievedLabels).to.deep.equal(['smoke', 'severity:high', 'feature:login']);
  });
});
