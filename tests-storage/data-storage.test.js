const { expect } = require('chai');
const fs = require('fs');
const path = require('path');
const { TESTOMAT_TMP_STORAGE_DIR } = require('../lib/constants');
const { fileSystem, removeColorCodes } = require('../lib/utils/utils');
const DataStorage = require('../lib/storages/data-storage');

describe('Storage', () => {
  before(() => {
    fileSystem.clearDir(TESTOMAT_TMP_STORAGE_DIR);
  });

  it('PUT data to FILE storage @TB0000002', () => {
    const dataType = 'test2';
    const storage = new DataStorage(dataType);
    const data = 'test data';
    storage.putData(data, '@TB0000002');
    const dataFilePath = path.join(TESTOMAT_TMP_STORAGE_DIR, dataType, `${dataType}_TB0000002`);
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
    expect(retrievedData).to.deep.equal([data]);
  });

  it('PUT data to GLOBAL storage @TB0000005', () => {
    const dataType = 'test5';
    const storage = new DataStorage(dataType);
    storage.isFileStorage = false;
    const data = 'test data';
    storage.putData(data, '@TB0000005');

    const retrievedData = storage.getData('@TB0000005');
    expect(storage.isFileStorage).to.equal(false);
    expect(retrievedData).to.deep.equal([data]);
  });

  it('GET data from GLOBAL storage @TB0000006', () => {
    const dataType = 'test6';
    const storage = new DataStorage(dataType);
    storage.isFileStorage = false;
    const data = 'test data';
    storage.putData(data, '@TB0000006');

    const retrievedData = storage.getData('@TB0000006');
    expect(storage.isFileStorage).to.equal(false);
    expect(retrievedData).to.deep.equal([data]);
  });
});

module.exports.removeColorCodes = removeColorCodes;
