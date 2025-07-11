import { exec } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class CodeceptTestRunner {
  constructor() {
    this.exampleDir = path.join(process.cwd(), 'example', 'codecept');
    this.debugFilePath = path.join(os.tmpdir(), 'testomatio.debug.latest.json');
  }

  cleanupDebugFiles() {
    const debugFiles = fs.readdirSync(os.tmpdir()).filter(f => f.startsWith('testomatio.debug.'));
    debugFiles.forEach(f => {
      try {
        fs.unlinkSync(path.join(os.tmpdir(), f));
      } catch (e) {
      }
    });
  }

  async runCodeceptTest(testConfig = {}, extraEnv = {}) {
    this.cleanupDebugFiles();

    let cmd;
    if (typeof testConfig === 'string') {
      cmd = `npx codeceptjs run ${testConfig}`;
    } else {
      const { testFile = 'simple_test.js', grep = null, tags = null } = testConfig;
      cmd = `npx codeceptjs run ${testFile}`;
      if (grep) cmd += ` --grep "${grep}"`;
      if (tags) cmd += ` --grep "${tags}"`;
    }
    
    let stdout, stderr;
    try {
      const result = await execAsync(cmd, {
        cwd: this.exampleDir,
        env: {
          ...process.env,
          TESTOMATIO_DEBUG: '1',
          TESTOMATIO_DISABLE_BATCH_UPLOAD: '1',
          ...extraEnv
        }
      });
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (error) {
      stdout = error.stdout || '';
      stderr = error.stderr || '';
    }

    let debugData = [];
    let testEntries = [];
    
    if (!fs.existsSync(this.debugFilePath)) throw new Error('Debug file not found');

    const debugContent = fs.readFileSync(this.debugFilePath, 'utf-8');
    debugData = debugContent.trim().split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
    testEntries = debugData.filter(entry => entry.action === 'addTest');
    

    return { stdout, stderr, debugData, testEntries };
  }

  setupTestEnvironment() {
    this.cleanupDebugFiles();
  }

  cleanupTestEnvironment() {
    this.cleanupDebugFiles();
  }
}

export const codeceptTestRunner = new CodeceptTestRunner();

export async function runCodeceptTest(testConfig, extraEnv = {}) {
  return await codeceptTestRunner.runCodeceptTest(testConfig, extraEnv);
}