const { expect } = require('chai');
const fs = require('fs');
const path = require('path');
const { TESTOMAT_TMP_STORAGE_DIR } = require('../lib/constants');
const { dataStorage } = require('../lib/data-storage');

describe('Logger 2', () => {
  it('logs are not intercepted by mocha if TESTOMATIO_INTERCEPT_CONSOLE_LOGS is not set @T00000018', () => {
    dataStorage.setContext('@T00000018');
    const message = 'test log message';
    console.log(message);
    const logFilePath = path.join(TESTOMAT_TMP_STORAGE_DIR, 'log', 'log_T00000018');
    expect(fs.existsSync(logFilePath)).to.equal(false);
  });
});
