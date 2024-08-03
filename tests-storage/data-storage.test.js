import { expect } from 'chai';
import fs from 'fs';
import path from 'path';
import { TESTOMAT_TMP_STORAGE_DIR } from '../lib/constants';
import { fileSystem, removeColorCodes } from '../lib/utils/utils';
import { dataStorage, stringToMD5Hash } from '../lib/data-storage';

describe('Storage', () => {
  before(() => {
    fileSystem.clearDir(TESTOMAT_TMP_STORAGE_DIR);
  });

  it('PUT data to FILE storage @TB0000002', () => {
    const dataType = 'test2';
    const data = 'test data';
    // @ts-ignore passing unexisting data type intentionally
    dataStorage.putData(dataType, data, 'PUT data to FILE storage @TB0000002');
    const contextHash = stringToMD5Hash('PUT data to FILE storage @TB0000002');
    const dataFilePath = path.join(TESTOMAT_TMP_STORAGE_DIR, dataType, `${dataType}_${contextHash}`);
    expect(fs.existsSync(dataFilePath)).to.equal(true);
    const dataContent = fs.readFileSync(dataFilePath, 'utf8');
    expect(dataContent).to.equal(data);
  });

  it('GET data from FILE storage @TB0000003', () => {
    const dataType = 'test3';
    const data = 'test data';
    const contextHash = stringToMD5Hash('GET data from FILE storage @TB0000003');
    // @ts-ignore passing unexisting data type intentionally
    dataStorage.putData(dataType, data, contextHash);

    // @ts-ignore passing unexisting data type intentionally
    const retrievedData = dataStorage.getData(dataType, contextHash);
    expect(retrievedData).to.deep.equal([data]);
  });

  it('PUT data to GLOBAL storage @TB0000005', () => {
    const dataType = 'test5';
    dataStorage.isFileStorage = false;
    const data = 'test data';
    // @ts-ignore passing unexisting data type intentionally
    dataStorage.putData(dataType, data, '@TB0000005');

    // @ts-ignore passing unexisting data type intentionally
    const retrievedData = dataStorage.getData(dataType, '@TB0000005');
    expect(dataStorage.isFileStorage).to.equal(false);
    expect(retrievedData).to.deep.equal([data]);
  });

  it('GET data from GLOBAL storage @TB0000006', () => {
    const dataType = 'test6';
    dataStorage.isFileStorage = false;
    const data = 'test data';
    // @ts-ignore passing unexisting data type intentionally
    dataStorage.putData(dataType, data, '@TB0000006');

    // @ts-ignore passing unexisting data type intentionally
    const retrievedData = dataStorage.getData(dataType, '@TB0000006');
    expect(dataStorage.isFileStorage).to.equal(false);
    expect(retrievedData).to.deep.equal([data]);
  });
});

export { removeColorCodes };
