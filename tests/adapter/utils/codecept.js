import { exec } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';
import { extractTestEntries } from './extract-test-entries.js';

const execAsync = promisify(exec);

export class CodeceptTestRunner {
  constructor() {
    this.exampleDir = path.join(process.cwd(), 'example', 'codecept');
    // Debug symlink is created in the cwd of the spawned codeceptjs process (exampleDir),
    // not in the test runner's cwd.
    this.debugFilePath = path.join(this.exampleDir, 'testomatio.debug.json');
  }

  cleanupDebugFiles() {
    const debugFiles = fs.readdirSync(os.tmpdir()).filter(f => f.startsWith('testomatio.debug.'));
    debugFiles.forEach(f => {
      try {
        fs.unlinkSync(path.join(os.tmpdir(), f));
      } catch (e) {}
    });
    // Also remove symlink if it exists. Use lstatSync — existsSync follows the
    // link and returns false for dangling symlinks, which would leave them in place.
    try {
      fs.lstatSync(this.debugFilePath);
      fs.unlinkSync(this.debugFilePath);
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
  }

  async run(testConfig = {}, extraEnv = {}) {
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
          ...extraEnv,
        },
      });
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (error) {
      stdout = error.stdout || '';
      stderr = error.stderr || '';
    }
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Use the symlink to the latest debug file
    const debugFilePath = this.debugFilePath;
    if (!fs.existsSync(debugFilePath)) {
      throw new Error('Debug file not found');
    }

    const debugContent = fs.readFileSync(debugFilePath, 'utf-8');
    const debugData = debugContent
      .trim()
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
    const testEntries = extractTestEntries(debugData);
    return { stdout, stderr, debugData, testEntries };
  }

  async runWorkers(testConfig = {}, extraEnv = {}) {
    this.cleanupDebugFiles();
    let cmd = `npx codeceptjs run-workers 2`;
    if (typeof testConfig === 'object') {
      const { grep = null, tags = null } = testConfig;
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
          ...extraEnv,
        },
      });
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (error) {
      stdout = error.stdout || '';
      stderr = error.stderr || '';
    }
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Use the symlink to the latest debug file
    const debugFilePath = this.debugFilePath;
    if (!fs.existsSync(debugFilePath)) {
      throw new Error('Debug file not found');
    }

    const debugContent = fs.readFileSync(debugFilePath, 'utf-8');
    const debugData = debugContent
      .trim()
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
    const testEntries = extractTestEntries(debugData);
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

export async function runTests(testConfig, extraEnv = {}) {
  return await codeceptTestRunner.run(testConfig, extraEnv);
}

export async function runWorkers(testConfig, extraEnv = {}) {
  return await codeceptTestRunner.runWorkers(testConfig, extraEnv);
}
