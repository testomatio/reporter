#!/usr/bin/env node
const { spawn } = require('child_process');
const program = require('commander');
const chalk = require('chalk');
const TestomatClient = require('../client');
const { APP_PREFIX, FINISHED } = require('../constants');
const { version } = require('../../package.json');

console.log(chalk.cyan.bold(` 🤩 Testomat.io Reporter v${version}`));

program
  .option('-c, --command <cmd>', 'Test runner command')
  .option('--launch', 'Start a new run and return its ID')
  .option('--finish', 'Finish Run by its ID')
  .option("--env-file <envfile>", "Load environment variables from env file")
  .action(opts => {

    const { command, launch, finish } = opts;
    if (opts.envFile) require('dotenv').config(opts.envFile); // eslint-disable-line

    const apiKey = process.env['INPUT_TESTOMATIO-KEY'] || process.env.TESTOMATIO;
    const title = process.env.TESTOMATIO_TITLE;

    if (launch) {
      console.log('Starting a new Run on Testomat.io...');
      const client = new TestomatClient({ apiKey });

      client.createRun().then(() => {
        console.log(process.env.runId);
        process.exit(0);
      });
      return;
    }

    if (finish) {
      if (!process.env.TESTOMATIO_RUN) {
        console.log('TESTOMATIO_RUN environment variable must be set.');
        return process.exit(1);
      }

      console.log('Finishing Run on Testomat.io...');

      const client = new TestomatClient({ apiKey });

      client.updateRunStatus(FINISHED, true).then(() => {
        console.log(chalk.yellow(`Run ${process.env.TESTOMATIO_RUN} was finished`));
        process.exit(0);
      });
      return;
    }

    let exitCode = 0;

    if (!command.split) {
      process.exitCode = 255;
      console.log(APP_PREFIX, `No command provided. Use -c option to launch a test runner.`);
      return;
    }

    const testCmds = command.split(' ');
    console.log(APP_PREFIX, `🚀 Running`, chalk.green(command));

    if (!apiKey) {
      const cmd = spawn(testCmds[0], testCmds.slice(1), { stdio: 'inherit' });

      cmd.on('close', code => {
        console.log(APP_PREFIX, '⚠️ ', `Runner exited with ${chalk.bold(code)}, report is ignored`);

        if (code > exitCode) exitCode = code;
        process.exitCode = exitCode;
      });

      return;
    }

    const client = new TestomatClient({ apiKey, title, parallel: true });

    client.createRun().then(() => {
      const cmd = spawn(testCmds[0], testCmds.slice(1), { stdio: 'inherit' });

      cmd.on('close', code => {
        const emoji = code === 0 ? '🟢' : '🔴';
        console.log(APP_PREFIX, emoji, `Runner exited with ${chalk.bold(code)}`);
        const status = code === 0 ? 'passed' : 'failed';
        client.updateRunStatus(status, true);

        if (code > exitCode) exitCode = code;
        process.exitCode = exitCode;
      });
    });
  });

if (process.argv.length <= 2) {
  program.outputHelp();
}

program.parse(process.argv);
