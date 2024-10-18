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
    process.env.TESTOMATIO_DEBUG = 1;
    debugPipe = new DebugPipe({});
    logFilePath = debugPipe.logFileName;
    expect(fs.existsSync(logFilePath)).to.be.true;
  });

  afterEach(() => {
    if (fs.existsSync(logFilePath)) {
      fs.rmSync(logFilePath, { recursive: true });
    }
  });

  it('should create log file and write log data when enabled', async () => {
    await debugPipe.logToFile(LOG_DATA);
    const savedData = await fs.readFileSync(logFilePath, 'utf-8').trim().split('\n');
    expect(savedData.length).to.equal(3);
    expect(savedData[0]).to.equal(
      JSON.stringify({
        data: 'variables',
        testomatioEnvVars: debugPipe.testomatioEnvVars,
      }),
    );
    expect(savedData[1]).to.equal(JSON.stringify({ data: 'store', store: {} }));
    expect(savedData[2]).to.equal(JSON.stringify(LOG_DATA));
  });

  it('should not log data when TESTOMATIO_DEBUG is not set', async () => {
    delete process.env.TESTOMATIO_DEBUG;
    const debugPipeWithoutLogging = new DebugPipe({});
    await debugPipeWithoutLogging.logToFile(LOG_DATA);
    expect(fs.existsSync(debugPipeWithoutLogging.logFileName)).to.be.false;
  });

  it('should handle batch upload and log multiple tests in a batch', async () => {
    debugPipe.batch.tests = [{ id: 'test1' }, { id: 'test2' }];
    await debugPipe.batchUpload();
    const savedData = await fs.readFileSync(logFilePath, 'utf-8').trim().split('\n');
    expect(savedData.length).to.equal(3);
    expect(savedData[2]).to.equal(
      JSON.stringify({ action: 'addTestsBatch', tests: [{ id: 'test1' }, { id: 'test2' }] }),
    );
  });

  it('should clear interval on finishRun and save final log', async () => {
    debugPipe.isBatchEnabled = true;
    debugPipe.batch.intervalFunction = setInterval(() => {}, 5000);
    await debugPipe.finishRun({});
    const savedData = await fs.readFileSync(logFilePath, 'utf-8').trim().split('\n');
    expect(savedData.some(line => line.includes('"actions":"finishRun"'))).to.be.true;
  });

  it('should append data to the same log file', async () => {
    await debugPipe.logToFile({ action: 'firstTest' });
    await debugPipe.logToFile({ action: 'secondTest' });
    const savedData = await fs.readFileSync(logFilePath, 'utf-8').trim().split('\n');
    expect(savedData.length).to.equal(4);
    expect(savedData[2]).to.equal(JSON.stringify({ action: 'firstTest' }));
    expect(savedData[3]).to.equal(JSON.stringify({ action: 'secondTest' }));
  });
});
