import { expect } from 'chai';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { DebugPipe } from '../../../src/pipe/debug.js';
import { getDebugFilePath } from '../../../src/utils/debug.js';

const LOG_DATA = {
  action: 'testAction',
  data: 'testData',
};

describe('DebugPipe logging tests', () => {
  let logFilePath;
  let debugPipe;
  let createdFiles = [];

  beforeEach(() => {
    process.env.TESTOMATIO_DEBUG = 1;
    debugPipe = new DebugPipe({});
    logFilePath = debugPipe.logFilePath;
    expect(fs.existsSync(logFilePath)).to.be.true;
  });

  afterEach(() => {
    // Clean up all debug files created during tests
    createdFiles.forEach(file => {
      try {
        if (fs.existsSync(file)) {
          fs.rmSync(file, { recursive: true, force: true });
        }
      } catch (e) {
        // Ignore errors during cleanup
      }
    });
    createdFiles = [];

    // Also clean up symlink if it exists
    const symlinkPath = path.join(process.cwd(), 'testomatio.debug.json');
    try {
      if (fs.existsSync(symlinkPath)) {
        fs.unlinkSync(symlinkPath);
      }
    } catch (e) {
      // Ignore errors during cleanup
    }
  });

  function trackFile(filePath) {
    createdFiles.push(filePath);
    // Also track the symlink
    const symlinkPath = path.join(process.cwd(), 'testomatio.debug.json');
    if (!createdFiles.includes(symlinkPath)) {
      createdFiles.push(symlinkPath);
    }
  }

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

  describe('DebugPipe file management', () => {
    it('should create timestamped files in tmp dir and symlink in project root', () => {
      const paths = getDebugFilePath();
      expect(paths.root).to.equal(path.join(process.cwd(), 'testomatio.debug.json'));
      expect(paths.tmp).to.include(os.tmpdir());
      expect(paths.tmp).to.include('testomatio.debug.');
      expect(paths.tmp).to.match(/\.json$/);
    });

    it('should create multiple timestamped files in tmp dir and update symlink to latest', async () => {
      const symlinkPath = path.join(process.cwd(), 'testomatio.debug.json');
      const tmpFiles = [];

      // Create first debug pipe instance
      const pipe1 = new DebugPipe({});
      const firstFilePath = pipe1.logFilePath;
      trackFile(firstFilePath);
      expect(fs.existsSync(firstFilePath), 'First file should exist in tmp').to.be.true;
      expect(fs.existsSync(symlinkPath), 'Symlink should exist').to.be.true;

      // Verify symlink points to first file
      const firstLinkTarget = fs.readlinkSync(symlinkPath);
      expect(firstLinkTarget).to.equal(firstFilePath);
      tmpFiles.push(firstFilePath);

      // Wait past the next second boundary — getDebugFilePath rounds to seconds
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Create second debug pipe instance
      const pipe2 = new DebugPipe({});
      const secondFilePath = pipe2.logFilePath;
      trackFile(secondFilePath);
      expect(fs.existsSync(secondFilePath), 'Second file should exist in tmp').to.be.true;
      expect(secondFilePath).to.not.equal(firstFilePath, 'Second file should have different path');
      tmpFiles.push(secondFilePath);

      // Verify symlink now points to second file
      const secondLinkTarget = fs.readlinkSync(symlinkPath);
      expect(secondLinkTarget).to.equal(secondFilePath);
      expect(secondLinkTarget).to.not.equal(firstFilePath, 'Symlink should point to latest file');

      // Verify both files exist in tmp
      tmpFiles.forEach(file => {
        expect(fs.existsSync(file), `File ${file} should still exist`).to.be.true;
      });

      // Verify we can read from the symlink and it points to the latest file
      const contentFromSymlink = fs.readFileSync(symlinkPath, 'utf-8');
      const contentFromSecondFile = fs.readFileSync(secondFilePath, 'utf-8');
      expect(contentFromSymlink).to.equal(contentFromSecondFile);
    });

    it('should store history in tmp dir with ISO datetime format', async () => {
      const paths = getDebugFilePath();
      const tmpFileName = path.basename(paths.tmp);

      // Verify filename format: testomatio.debug.YYYY-MM-DDTHH-MM-SS.json
      expect(tmpFileName).to.match(/^testomatio\.debug\.\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.json$/);
    });
  });
});
