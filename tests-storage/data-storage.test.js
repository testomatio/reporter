const { expect } = require('chai');
const fs = require('fs');
const path = require('path');
const { TESTOMAT_TMP_STORAGE } = require('../lib/constants');
const { fileSystem, removeColorCodes } = require('../lib/util');
const DataStorage = require('../lib/storages/data-storage');

describe('Storage', () => {
  before(() => {
    fileSystem.clearDir(TESTOMAT_TMP_STORAGE.mainDir);
  });

  it('PUT data to FILE storage @TB0000002', () => {
    const dataType = 'test2';
    const storage = new DataStorage(dataType);
    const data = 'test data';
    storage.putData(data, '@TB0000002');
    const dataFilePath = path.join(TESTOMAT_TMP_STORAGE.mainDir, dataType, `${dataType}_B0000002`);
    expect(fs.existsSync(dataFilePath)).to.equal(true);
    const dataContent = fs.readFileSync(dataFilePath, 'utf8');
    expect(dataContent).to.equal(data);
  });

  it('GET data from FILE storage @TB0000003', () => {
    const dataType = 'test3';
    const storage = new DataStorage(dataType);
    const data = 'test data';
    storage.putData(data, '@TB0000003');

    const retrievedData = storage.getData('@TB0000003');
    expect(retrievedData).to.equal(data);
  });

  it('PUT data to GLOBAL storage @TB0000005', () => {
    const dataType = 'test5';
    const storage = new DataStorage(dataType);
    storage.isFileStorage = false;
    const data = 'test data';
    storage.putData(data, '@TB0000005');

    const retrievedData = storage.getData('@TB0000005');
    expect(storage.isFileStorage).to.equal(false);
    expect(retrievedData).to.equal(data);
  });
});

module.exports.removeColorCodes = removeColorCodes;
