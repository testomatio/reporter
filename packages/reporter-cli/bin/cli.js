#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const standaloneCliPath = path.resolve(__dirname, '../src/bin/cli.js');
const repositoryCliPath = path.resolve(__dirname, '../../../src/bin/cli.js');
const targetCli = existsSync(standaloneCliPath) ? standaloneCliPath : repositoryCliPath;

if (!existsSync(targetCli)) {
  console.error('[testomatio-reporter] Cannot resolve standalone CLI entrypoint.');
  process.exit(1);
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
