#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { getPackageVersion } from '../utils/utils.js';
import pc from 'picocolors';

// Define __dirname - this will be replaced by build script with actual __dirname for CommonJS
const __dirname = typeof globalThis.__dirname !== 'undefined' ? globalThis.__dirname : '.';
const cliPath = join(__dirname, 'cli.js');

const version = getPackageVersion();
console.log(pc.cyan(pc.bold(` 🤩 Testomat.io Reporter v${version}`)));

// Parse command line arguments to map start-test-run options to @testomatio/reporter run format
const args = process.argv.slice(2);
const newArgs = ['run'];

let i = 0;
while (i < args.length) {
  const arg = args[i];

  if (arg === '-c' || arg === '--command') {
    // Map -c/--command to positional argument for run command
    i++;
    if (i < args.length) {
      newArgs.push(args[i]);
    }
  } else if (arg.startsWith('--command=')) {
    // Handle --command=value format
    const command = arg.split('=', 2)[1];
    newArgs.push(command);
  } else if (arg === '--launch') {
    // Map --launch to start command
    newArgs[0] = 'start';
  } else if (arg === '--finish') {
    // Map --finish to finish command
    newArgs[0] = 'finish';
  } else {
    // Pass through other arguments
    newArgs.push(arg);
  }
  i++;
}

// Execute the main CLI with mapped arguments

const child = spawn(process.execPath, [cliPath, ...newArgs], {
  stdio: 'inherit',
});

child.on('exit', code => {
  process.exit(code);
});
