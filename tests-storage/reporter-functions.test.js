const { expect } = require('chai');
const fs = require('fs');
const path = require('path');
const { TESTOMAT_TMP_STORAGE } = require('../lib/constants');
const { fileSystem, removeColorCodes } = require('../lib/util');
const { testomat } = require('../lib/reporter');

describe('Testomat reporter functions', () => {
  before(() => {
    fileSystem.clearDir(TESTOMAT_TMP_STORAGE.mainDir);
  });

  /* failed when run in this scope
  it('log using testomat.log function @T00000017', () => {
    const message = '- - - - - - - - - - - - - - - - - -- - - - - - - - -- - - - - -test log message';
    testomat.log(message);
    const logFilePath = path.join(TESTOMAT_TMP_STORAGE.mainDir, 'log', 'log_00000017');
    expect(fs.existsSync(logFilePath)).to.equal(true);
    const logContent = removeColorCodes(fs.readFileSync(logFilePath, 'utf8'));
    expect(logContent).to.equal(`${message}`);
  });
  */

  it('step using testomat.step function @T00000018', () => {
    const message = 'test step message';
    testomat.step(message);
    const logFilePath = path.join(TESTOMAT_TMP_STORAGE.mainDir, 'log', 'log_00000018');
    expect(fs.existsSync(logFilePath)).to.equal(true);
    const logContent = removeColorCodes(fs.readFileSync(logFilePath, 'utf8'));
    expect(logContent).to.equal(`> ${message}`);
  });
});
