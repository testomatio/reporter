const fs = require('fs');
const { expect } = require('chai');
const DebugPipe = require('../../lib/pipe/debug');

const LOG_DATA = {
  action: 'testAction',
  data: 'testData',
};

describe('DebugPipe logging tests', () => {
  let logFilePath;
  let debugPipe;

  beforeEach(() => {
    process.env.TESTOMATIO_DEBUG = '1';
    process.env.TESTOMATIO_ENV = 'Chrome, Windows';
    process.env.TESTOMATIO_URL = 'https://beta.testomat.io';

    debugPipe = new DebugPipe({});
    logFilePath = debugPipe.logFileName;

    expect(fs.existsSync(logFilePath)).to.be.true;
  });

  afterEach(async () => {
    delete process.env.TESTOMATIO_DEBUG;
    delete process.env.TESTOMATIO_ENV;
    delete process.env.TESTOMATIO_URL;

    if (fs.existsSync(logFilePath)) {
      await fs.promises.rm(logFilePath, { recursive: true });
    }
  });

  it('should create log file and write log data when enabled', async () => {
    await debugPipe.logToFile(LOG_DATA);
    await new Promise(resolve => {
      setTimeout(resolve, 1000);
    });
    const savedData = fs.readFileSync(logFilePath, 'utf-8').trim().split('\n');
    expect(savedData.length).to.equal(3);

    expect(savedData[0]).to.equal(
      JSON.stringify({
        actions: 'preconditions',
        testomatioEnvVars: {
          TESTOMATIO_DEBUG: '1',
          TESTOMATIO_ENV: 'Chrome, Windows',
          TESTOMATIO_URL: 'https://beta.testomat.io',
        },
      }),
    );

    expect(savedData[1]).to.equal(JSON.stringify({ actions: 'store', store: {} }));
    expect(savedData[2]).to.equal(JSON.stringify(LOG_DATA));
  });

  it('should not log data when TESTOMATIO_DEBUG is not set', async () => {
    delete process.env.TESTOMATIO_DEBUG;
    await debugPipe.logToFile(LOG_DATA);

    const savedData = fs.readFileSync(debugPipe.logFileName, 'utf-8');
    expect(savedData).to.equal('');
  });

  it('should handle batch upload and log multiple tests in a batch', async () => {
    debugPipe.batch.tests = [{ id: 'test1' }, { id: 'test2' }];
    await debugPipe.batchUpload();
    await new Promise(resolve => {
      setTimeout(resolve, 1000);
    });
    const savedData = fs.readFileSync(logFilePath, 'utf-8').trim().split('\n');
    expect(savedData.length).to.equal(3);

    expect(savedData[2]).to.equal(
      JSON.stringify({ action: 'addTestsBatch', tests: [{ id: 'test1' }, { id: 'test2' }] }),
    );
  });

  it('should clear interval on finishRun and save final log', async () => {
    debugPipe.isBatchEnabled = true;
    debugPipe.batch.intervalFunction = setInterval(() => {}, 5000);

    await debugPipe.finishRun({});
    await new Promise(resolve => {
      setTimeout(resolve, 1000);
    });
    const savedData = fs.readFileSync(logFilePath, 'utf-8').trim().split('\n');

    expect(savedData.some(line => line.includes('"actions":"finishRun"'))).to.be.true;
  });

  it('should append data to the same log file', async () => {
    await debugPipe.logToFile({ action: 'firstTest' });
    await new Promise(resolve => {
      setTimeout(resolve, 500);
    });
    await debugPipe.logToFile({ action: 'secondTest' });
    await new Promise(resolve => {
      setTimeout(resolve, 1000);
    });
    const savedData = fs.readFileSync(logFilePath, 'utf-8').trim().split('\n');

    expect(savedData.length).to.equal(4);
    expect(savedData[2]).to.equal(JSON.stringify({ action: 'firstTest' }));
    expect(savedData[3]).to.equal(JSON.stringify({ action: 'secondTest' }));
  });
});
