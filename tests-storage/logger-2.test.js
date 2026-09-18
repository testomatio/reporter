import { expect } from 'chai';
import fs from 'fs';
import path from 'path';
import { TESTOMAT_TMP_STORAGE_DIR } from '../lib/constants.js';
import { dataStorage } from '../lib/data-storage.js';

describe('Logger 2', () => {
  // test is moved to separate file because TESTOMATIO_INTERCEPT_CONSOLE_LOGS is passed when run "logger.test.js"
  // and even if reset TESTOMATIO_INTERCEPT_CONSOLE_LOGS, console is already intercepted
  it('logs are not intercepted by mocha if TESTOMATIO_INTERCEPT_CONSOLE_LOGS is not set @T00000018', () => {
    dataStorage.setContext('@T00000018');
    const message = 'test log message';
    process.env.TESTOMATIO_INTERCEPT_CONSOLE_LOGS = 'false';
    console.log(message);
    const logFilePath = path.join(TESTOMAT_TMP_STORAGE_DIR, 'log', 'log_T00000018');
    expect(fs.existsSync(logFilePath)).to.equal(false);
  });
});
