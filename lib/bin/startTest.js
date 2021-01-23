#!/usr/bin/env node
const { spawn } = require('child_process');
const program = require('commander');
const TestomatClient = require('../client');

console.log('Starting test run');

const apiKey = process.env['INPUT_TESTOMATIO-KEY'] || process.env['TESTOMATIO'] || 'lz8ea4948ud5';
const title = process.env['TESTOMATIO_TITLE'];

const client = new TestomatClient({ apiKey, title });

program
  .option('-c, --command <cmd>', 'Test command')
  .action(opts => {
    const { command } = opts;
    const testCmds = command.split(' ');
    console.log('🚀 Running ',...testCmds);

    client.createRun().then(() => {
      const cmd = spawn(testCmds[0], testCmds.slice(1), { stdio: 'inherit' });

      // cmd.stdout.on('data', (data) => {
      //   console.log(`${data}`);
      // });

      // cmd.stderr.on('data', (data) => {
      //   console.error(`stderr: ${data}`);
      // });

      cmd.on('close', (code) => {
        console.log(`Test run exited with ${code}`);
        const status = code === 0 ? 'passed' : 'failed';
        client.updateRunStatus(status);
      });
    });
  });

if (process.argv.length <= 2) {
  program.outputHelp();
}

program.parse(process.argv);
