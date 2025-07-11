import { expect } from 'chai';
import fs from 'fs';
import { DebugPipe } from '../../../src/pipe/debug.js';

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
    logFilePath = debugPipe.logFilePath;
    expect(fs.existsSync(logFilePath)).to.be.true;
  });

  afterEach(() => {
    if (fs.existsSync(logFilePath)) {
      fs.rmSync(logFilePath, { recursive: true });
    }
  });

  it('should create log file and write log data when enabled', async () => {
    await debugPipe.logToFile(LOG_DATA);
    const savedData = fs.readFileSync(logFilePath, 'utf-8').trim().split('\n');
    expect(savedData.length).to.equal(4);
    expect(savedData[1]).to.contain(
      JSON.stringify({
        data: 'variables',
        testomatioEnvVars: debugPipe.testomatioEnvVars,
      })
        // cut curly braces at start and end
        .slice(1, -1),
    );
    expect(savedData[2]).to.contain(JSON.stringify({ data: 'store', store: {} }).slice(1, -1));
    expect(savedData[3]).to.contain(JSON.stringify(LOG_DATA).slice(1, -1));
  });

  it('should not log data when TESTOMATIO_DEBUG is not set', async () => {
    delete process.env.TESTOMATIO_DEBUG;
    const debugPipeWithoutLogging = new DebugPipe({});
    await debugPipeWithoutLogging.logToFile(LOG_DATA);
    expect(fs.existsSync(debugPipeWithoutLogging.logFilePath)).to.be.false;
  });

  it('should handle batch upload and log multiple tests in a batch', async () => {
    debugPipe.batch.tests = [{ id: 'test1' }, { id: 'test2' }];
    await debugPipe.batchUpload();
    const savedData = fs.readFileSync(logFilePath, 'utf-8').trim().split('\n');
    expect(savedData.length).to.equal(4);
    expect(savedData[3]).to.contain(
      JSON.stringify({ action: 'addTestsBatch', tests: [{ id: 'test1' }, { id: 'test2' }] }).slice(1, -1),
    );
  });

  it('should clear interval on finishRun and save final log', async () => {
    debugPipe.isBatchEnabled = true;
    debugPipe.batch.intervalFunction = setInterval(() => {}, 5000);
    await debugPipe.finishRun({});
    const savedData = fs.readFileSync(logFilePath, 'utf-8').trim().split('\n');
    expect(savedData.some(line => line.includes('"action":"finishRun"'))).to.be.true;
  });

  it('should append data to the same log file', async () => {
    await debugPipe.logToFile({ action: 'firstTest' });
    await debugPipe.logToFile({ action: 'secondTest' });
    const savedData = fs.readFileSync(logFilePath, 'utf-8').trim().split('\n');
    expect(savedData.length).to.equal(5);
    expect(savedData[3]).to.contain(JSON.stringify({ action: 'firstTest' }).slice(1, -1));
    expect(savedData[4]).to.contain(JSON.stringify({ action: 'secondTest' }).slice(1, -1));
  });
});
