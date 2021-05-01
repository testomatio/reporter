#!/usr/bin/env node
const { spawn } = require('child_process');
const program = require('commander');
const TestomatClient = require('../client');

console.log('Starting test run');

const apiKey = process.env['INPUT_TESTOMATIO-KEY'] || process.env['TESTOMATIO'] || 'lz8ea4948ud5';
const title = process.env['TESTOMATIO_TITLE'];


program
  .option('-c, --command <cmd>', 'Test command')
  .action(opts => {
    const { command } = opts;
    const testCmds = command.split(' ');
    console.log('🚀 Running', ...testCmds);

    if (!apiKey) {
      const cmd = spawn(testCmds[0], testCmds.slice(1), { stdio: 'inherit' });

      cmd.on('close', (code) => {
        console.log(`Test run exited with ${code}, report is ignored`);
        process.exitCode = code;
      });

      return;
    }

    const client = new TestomatClient({ apiKey, title });

    client.createRun().then(() => {
      const cmd = spawn(testCmds[0], testCmds.slice(1), { stdio: 'inherit' });

      cmd.on('close', (code) => {
        console.log(`Test run exited with ${code}`);
        const status = code === 0 ? 'passed' : 'failed';
        client.updateRunStatus(status);
        process.exitCode = code;
      });
    });
  });

if (process.argv.length <= 2) {
  program.outputHelp();
}

program.parse(process.argv);
