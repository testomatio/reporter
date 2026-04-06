#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

let targetCli;
try {
  const reporterPackageJsonPath = require.resolve('@testomatio/reporter/package.json');
  const reporterPackageJson = JSON.parse(readFileSync(reporterPackageJsonPath, 'utf8'));
  const bin = reporterPackageJson.bin || {};
  const cliRelativePath =
    bin['testomatio/reporter'] ||
    bin['testomatio-reporter'] ||
    Object.values(bin).find(value => typeof value === 'string' && value.includes('cli.js'));

  if (!cliRelativePath) {
    throw new Error('Cannot detect CLI entry from @testomatio/reporter package.json bin field');
  }

  targetCli = path.resolve(path.dirname(reporterPackageJsonPath), cliRelativePath);
} catch (error) {
  const localCliPath = path.resolve(__dirname, '../../../src/bin/cli.js');
  if (existsSync(localCliPath)) {
    targetCli = localCliPath;
  } else {
    console.error('[testomatio-reporter] Cannot resolve @testomatio/reporter CLI entrypoint.');
    console.error(error?.message || error);
    process.exit(1);
  }
}

const child = spawn(process.execPath, [targetCli, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', code => {
  process.exit(code ?? 0);
});

child.on('error', error => {
  console.error('[testomatio-reporter] Failed to start CLI process.');
  console.error(error?.message || error);
  process.exit(1);
});
