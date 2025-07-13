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

    const codeceptCommand = extraEnv.CODECEPT_COMMAND || 'run';
    let cmd;
    
    if (codeceptCommand === 'run-workers') {
      // run-workers doesn't take specific test files, it runs all tests
      cmd = `npx codeceptjs ${codeceptCommand} 2`;
      // Add grep filters if specified
      if (typeof testConfig === 'object') {
        const { grep = null, tags = null } = testConfig;
        if (grep) cmd += ` --grep "${grep}"`;
        if (tags) cmd += ` --grep "${tags}"`;
      }
    } else {
      // Regular run command with specific test files
      if (typeof testConfig === 'string') {
        cmd = `npx codeceptjs ${codeceptCommand} ${testConfig}`;
      } else {
        const { testFile = 'simple_test.js', grep = null, tags = null } = testConfig;
        cmd = `npx codeceptjs ${codeceptCommand} ${testFile}`;
        if (grep) cmd += ` --grep "${grep}"`;
        if (tags) cmd += ` --grep "${tags}"`;
      }
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
    
    // Wait a bit for debug files to be written, especially in parallel mode
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (codeceptCommand === 'run-workers') {
      // For parallel execution, combine data from multiple debug files
      const debugFiles = fs.readdirSync(os.tmpdir())
        .filter(f => f.startsWith('testomatio.debug.') && f.endsWith('.json'))
        .map(f => path.join(os.tmpdir(), f))
        .filter(f => fs.existsSync(f));
      
      if (debugFiles.length === 0) {
        throw new Error('Debug file not found');
      }
      
      // Combine data from all debug files
      for (const debugFile of debugFiles) {
        try {
          const debugContent = fs.readFileSync(debugFile, 'utf-8');
          const fileData = debugContent.trim().split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
          debugData.push(...fileData);
        } catch (e) {
          // Skip files that can't be read or parsed
        }
      }
    } else {
      // For regular execution, use the single debug file
      if (!fs.existsSync(this.debugFilePath)) throw new Error('Debug file not found');

      const debugContent = fs.readFileSync(this.debugFilePath, 'utf-8');
      debugData = debugContent.trim().split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
    }
    
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