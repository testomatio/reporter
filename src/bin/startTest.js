#!/usr/bin/env node
import { spawn } from 'cross-spawn';
import { Command } from 'commander';
import pc from 'picocolors';
import TestomatClient from '../client.js';
import { APP_PREFIX, STATUS } from '../constants.js';
import { getPackageVersion } from '../utils/utils.js';
import { config } from '../config.js';
import dotenv from 'dotenv';
import { checkForEnvPassedAsArguments } from '../utils/cli_utils.js';

const version = getPackageVersion();
console.log(pc.cyan(pc.bold(` 🤩 Testomat.io Reporter v${version}`)));
const program = new Command();

checkForEnvPassedAsArguments();

program
  .option('-c, --command <cmd>', 'Test runner command')
  .option('--launch', 'Start a new run and return its ID')
  .option('--finish', 'Finish Run by its ID')
  .option('--env-file <envfile>', 'Load environment variables from env file')
  .option('--filter <filter>', 'Additional execution filter')
  .action(async opts => {
    const { launch, finish, filter } = opts;
    let { command } = opts;

    if (opts.envFile) dotenv.config({ path: opts.envFile });

    const apiKey = process.env['INPUT_TESTOMATIO-KEY'] || config.TESTOMATIO;
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
      // TODO: add error in case of TESTOMATIO environment variable is not set
      // because command is fine in console, but actually (on testomat.io) run is not finished
      if (!process.env.TESTOMATIO_RUN) {
        console.log('TESTOMATIO_RUN environment variable must be set.');
        return process.exit(1);
      }

      console.log('Finishing Run on Testomat.io...');

      const client = new TestomatClient({ apiKey });

      // @ts-ignore
      client.updateRunStatus(STATUS.FINISHED).then(() => {
        console.log(pc.yellow(`Run ${process.env.TESTOMATIO_RUN} was finished`));
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

    const client = new TestomatClient({ apiKey, title, parallel: true });

    if (filter) {
      const [pipe, ...optsArray] = filter.split(':');
      const pipeOptions = optsArray.join(':');

      try {
        const tests = await client.prepareRun({ pipe, pipeOptions });

        if (!tests || tests.length === 0) {
          return;
        }

        const grep = ` --grep (${tests.join('|')})`;
        command += grep;
      } catch (err) {
        console.log(APP_PREFIX, err);
      }
    }

    const testCmds = command.split(' ');
    console.log(APP_PREFIX, `🚀 Running`, pc.green(command));

    if (!apiKey) {
      const cmd = spawn(testCmds[0], testCmds.slice(1), { stdio: 'inherit' });

      cmd.on('close', code => {
        console.log(APP_PREFIX, '⚠️ ', `Runner exited with ${pc.bold(code)}, report is ignored`);

        if (code > exitCode) exitCode = code;
        process.exitCode = exitCode;
      });

      return;
    }

    client.createRun().then(() => {
      const cmd = spawn(testCmds[0], testCmds.slice(1), { stdio: 'inherit' });

      cmd.on('close', code => {
        const emoji = code === 0 ? '🟢' : '🔴';
        console.log(APP_PREFIX, emoji, `Runner exited with ${pc.bold(code)}`);
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
