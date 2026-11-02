import { expect } from 'chai';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'node:child_process';

const repositoryWrapperCliPath = path.resolve(process.cwd(), 'packages/reporter-cli/bin/cli.js');
const wrapperPackageJsonPath = path.resolve(process.cwd(), 'packages/reporter-cli/package.json');

function runWrapper(wrapperCliPath, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [wrapperCliPath, ...args], {
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', data => {
      stdout += data.toString();
    });

    child.stderr.on('data', data => {
      stderr += data.toString();
    });

    child.on('error', reject);
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
}

function extractJson(stdout) {
  const lines = stdout
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  const line = [...lines].reverse().find(item => item.startsWith('{') && item.endsWith('}'));
  if (!line) {
    throw new Error(`JSON payload not found in stdout: ${stdout}`);
  }

  return JSON.parse(line);
}

describe('reporter-cli wrapper', () => {
  let tempDir;
  let wrapperCliPath;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reporter-cli-wrapper-test-'));
    const binDir = path.join(tempDir, 'bin');
    const srcBinDir = path.join(tempDir, 'src', 'bin');
    fs.mkdirSync(binDir, { recursive: true });
    fs.mkdirSync(srcBinDir, { recursive: true });

    wrapperCliPath = path.join(binDir, 'cli.js');
    fs.copyFileSync(repositoryWrapperCliPath, wrapperCliPath);

    fs.writeFileSync(
      path.join(srcBinDir, 'cli.js'),
      [
        "const payload = {",
        '  argv: process.argv.slice(2),',
        '  env: {',
        "    CUSTOM_ENV: process.env.CUSTOM_ENV,",
        "    TESTOMATIO_CUSTOM: process.env.TESTOMATIO_CUSTOM,",
        '  },',
        '};',
        'console.log(JSON.stringify(payload));',
      ].join('\n'),
    );
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('forwards args/env for run command with wdio style command', async () => {
    const result = await runWrapper(wrapperCliPath, ['run', 'wdio --spec tests/e2e/smoke.e2e.js'], {
      CUSTOM_ENV: 'from-wrapper',
      TESTOMATIO_CUSTOM: 'tstmt-value',
    });

    expect(result.code).to.equal(0);
    const payload = extractJson(result.stdout);
    expect(payload.argv).to.deep.equal(['run', 'wdio --spec tests/e2e/smoke.e2e.js']);
    expect(payload.env.CUSTOM_ENV).to.equal('from-wrapper');
    expect(payload.env.TESTOMATIO_CUSTOM).to.equal('tstmt-value');
  });

  it('forwards args/env for run command with codeceptjs style command', async () => {
    const result = await runWrapper(
      wrapperCliPath,
      ['run', 'codeceptjs run --grep @smoke --config codecept.conf.js'],
      {
        CUSTOM_ENV: 'codecept',
        TESTOMATIO_CUSTOM: 'codecept-env',
      },
    );

    expect(result.code).to.equal(0);
    const payload = extractJson(result.stdout);
    expect(payload.argv).to.deep.equal(['run', 'codeceptjs run --grep @smoke --config codecept.conf.js']);
    expect(payload.env.CUSTOM_ENV).to.equal('codecept');
    expect(payload.env.TESTOMATIO_CUSTOM).to.equal('codecept-env');
  });

  it('does not depend on @testomatio/reporter package', () => {
    const packageJson = JSON.parse(fs.readFileSync(wrapperPackageJsonPath, 'utf8'));

    expect(packageJson.dependencies).to.not.have.property('@testomatio/reporter');
  });
});
