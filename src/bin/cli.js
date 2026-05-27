#!/usr/bin/env node

import { Command } from 'commander';
import { spawn } from 'cross-spawn';
import { glob } from 'glob';
import createDebugMessages from 'debug';
import TestomatClient from '../client.js';
import XmlReader from '../xmlReader.js';
import { APP_PREFIX, STATUS, DEBUG_FILE } from '../constants.js';
import { cleanLatestRunId, getPackageVersion, applyFilter } from '../utils/utils.js';
import { config } from '../config.js';
import { readLatestRunId } from '../utils/utils.js';
import pc from 'picocolors';
import { filesize as prettyBytes } from 'filesize';
import dotenv from 'dotenv';
import Replay from '../replay.js';
import { log } from '../utils/log.js';
import { formatFilterListIds } from '../utils/pipe_utils.js';

const debug = createDebugMessages('@testomatio/reporter:cli');
const version = getPackageVersion();
const program = new Command();

program
  .version(version)
  .option('--env-file <envfile>', 'Load environment variables from env file')
  .hook('preAction', (thisCommand, actionCommand) => {
    const opts = thisCommand.opts();
    if (opts.envFile) {
      dotenv.config({ path: opts.envFile });
    } else {
      dotenv.config();
    }

    // --filter-list produces a machine-readable test list on stdout, so route
    // remaining output to stderr, skip the banner, and silence info-level
    // logs so the terminal isn't flooded with progress noise.
    // Set TESTOMATIO_LOG_LEVEL=INFO to re-enable progress logs for debugging.
    const subOpts = actionCommand.opts();
    if (subOpts.filterList || subOpts.format) {
      process.env.TESTOMATIO_LOG_STDERR = '1';
      process.env.TESTOMATIO_LOG_LEVEL ||= 'WARN';
    } else {
      console.log(pc.cyan(pc.bold(` 🤩 Testomat.io Reporter v${version}`)));
    }
  });

program
  .command('start')
  .description('Start a new run and return its ID')
  .option('--kind <type>', 'Specify run type: automated, manual, or mixed')
  .action(async opts => {
    cleanLatestRunId();

    console.log('Starting a new Run on Testomat.io...');
    const apiKey = process.env['INPUT_TESTOMATIO-KEY'] || config.TESTOMATIO;
    const client = new TestomatClient({ apiKey });

    const createRunParams = {};
    if (opts.kind) {
      createRunParams.kind = opts.kind;
    }

    client.createRun(createRunParams).then(() => {
      console.log(process.env.runId);
      process.exit(0);
    });
  });

program
  .command('finish')
  .description('Finish Run by its ID')
  .action(async () => {
    process.env.TESTOMATIO_RUN ||= readLatestRunId();

    if (!process.env.TESTOMATIO_RUN) {
      console.log('TESTOMATIO_RUN environment variable must be set or restored from a previous run.');
      return process.exit(1);
    }

    console.log('Finishing Run on Testomat.io...');
    const apiKey = process.env['INPUT_TESTOMATIO-KEY'] || config.TESTOMATIO;
    const client = new TestomatClient({ apiKey });

    // @ts-ignore
    client.updateRunStatus(STATUS.FINISHED).then(() => {
      process.exit(0);
    });
  });

program
  .command('run')
  .alias('test')
  .description('Run tests with the specified command')
  .argument('[command]', 'Test runner command')
  .option('--filter <filter>', 'Additional execution filter')
  .option('--filter-list <filter>', 'Get a list of all tests by filter before running')
  .option('--format <format>', 'Machine-readable output format for --filter-list (grep, json, newline, ids)')
  .option('--kind <type>', 'Specify run type: automated, manual, or mixed')
  .option('--remote <profile>', 'Trigger run on the named Testomat.io CI profile instead of executing locally')
  .option(
    '--remote-override <kv>',
    'key=value pair forwarded to the CI profile config (repeat for multiple)',
    (value, prev) => prev.concat([value]),
    [],
  )
  .action(async (command, opts) => {
    if (opts.remote) {
      if (opts.filterList) {
        log.warn(pc.red('⚠️  --filter-list cannot be combined with --remote'));
        process.exit(1);
      }
      process.env.TESTOMATIO_CI_PROFILE = opts.remote;
      if (opts.remoteOverride?.length) {
        process.env.TESTOMATIO_CI_OVERRIDE = opts.remoteOverride.join(',');
      }
    }

    const apiKey = process.env['INPUT_TESTOMATIO-KEY'] || config.TESTOMATIO;
    const title = process.env.TESTOMATIO_TITLE;
    const client = new TestomatClient({ apiKey, title });

    if (opts.filter || opts.filterList) {
      log.info('Filtering tests...');
      // Example of use: npx @testomatio/reporter run "npx jest" --filter "testomatio:tag-name=frontend"
      // Example of use: npx @testomatio/reporter run "npx jest" --filter "coverage:file=coverage.yml"
      // Example of use: npx @testomatio/reporter run --filter-list "coverage:file=coverage.yml" --format grep
      const [pipe, ...optsArray] = opts?.filter ? opts?.filter.split(':') : opts?.filterList.split(':');
      const pipeOptions = optsArray.join(':');

      const prepareRunParams = { pipe, pipeOptions };
      if (opts.filterList) {
        client.pipeStore.filterList = true;
      }

      try {
        const tests = await client.prepareRun(prepareRunParams);

        if (!tests || tests.length === 0) {
          log.warn( pc.yellow('No tests found.'));
          // Exit non-zero on --filter-list so scripts can detect "nothing to run"
          // via $? and skip launching the runner.
          if (opts.filterList) process.exit(1);
          return;
        }

        if (opts.filterList) {
          const out = formatFilterListIds(tests, opts.format || 'ids');
          if (out) console.log(out);
          // Show the runnable-command hint only in interactive mode (no explicit --format).
          // When --format is set the user is scripting and doesn't need stderr noise.
          if (command && !opts.format) {
            log.info(pc.green(`Full Running Command: ${applyFilter(command, tests)}`));
          }
          return;
        }

        if (command && command.split && !opts.remote) {
          command = applyFilter(command, tests);
        }
      }
      catch (err) {
        log.error( err.message || err);
        if (opts.filterList) process.exit(1);
        return;
      }
    }

    if (opts.remote) {
      if (!apiKey) {
        log.warn(pc.red('⚠️  TESTOMATIO API key required for --remote'));
        process.exit(1);
      }
      if (command) {
        log.warn(pc.yellow('Note: positional command is ignored when --remote is set; CI runs the workflow.'));
      }

      const createRunParams = {};
      if (title) createRunParams.title = title;
      if (opts.kind) createRunParams.kind = opts.kind;

      try {
        await client.createRun(createRunParams);
      } catch (err) {
        log.warn(pc.red(`CI launch failed: ${err.message || err}`));
        process.exit(1);
      }

      log.info(`🚀 CI build triggered on profile ${pc.cyan(opts.remote)}`);
      if (client.pipeStore.runUrl) log.info(`📊 Report URL: ${pc.magenta(client.pipeStore.runUrl)}`);
      return process.exit(0);
    }

    // just create a run (wich tests which match filters) without executing tests
    if (!command || !command.split) {
      const createRunParams = {};
      if (title) {
        createRunParams.title = title;
      }
      if (opts.kind) {
        createRunParams.kind = opts.kind;
      }

      if (apiKey) {
        await client.createRun(createRunParams);
        const runId = process.env.TESTOMATIO_RUN || process.env.runId;
        if (client.pipeStore.runUrl) log.info( `📊 Report URL: ${pc.magenta(client.pipeStore.runUrl)}`);

        if (opts.kind !== 'manual') {
          log.info( `No command passed, so you need to run tests yourself:`);
          log.info( `TESTOMATIO_RUN=${runId} <command>`);
        }
      } else {
        log.info( '⚠️  No API key provided. Cannot create run without TESTOMATIO key.');
        process.exit(1);
      }
      return process.exit(0);
    }

    log.info( `🚀 Running`, pc.green(command));

    const runTests = async () => {
      const testCmds = command.split(' ');
      const cmd = spawn(testCmds[0], testCmds.slice(1), {
        stdio: 'inherit',
        env: { ...process.env, TESTOMATIO_PROCEED: 'true', runId: client.runId, TESTOMATIO_RUN: client.runId },
      });

      cmd.on('close', async code => {
        const emoji = code === 0 ? '🟢' : '🔴';
        log.info( emoji, `Runner exited with ${pc.bold(code)}`);
        if (apiKey) {
          const status = code === 0 ? 'passed' : 'failed';
          await client.updateRunStatus(status);
        }
        process.exit(code);
      });
    };

    const createRunParams = {};
    if (title) {
      createRunParams.title = title;
    }
    if (opts.kind) {
      createRunParams.kind = opts.kind;
    }

    if (apiKey) {
      await client.createRun(createRunParams).then(runTests);
    } else {
      await runTests();
    }
  });

// program
// .command('xml')
// .description('Parse XML reports and upload to Testomat.io')
// .argument('<pattern>', 'XML file pattern')
// .option('-d, --dir <dir>', 'Project directory')
// .option('--java-tests [java-path]', 'Load Java tests from path, by default: src/test/java')
// .option('--lang <lang>', 'Language used (python, ruby, java)')
// .option('--timelimit <time>', 'default time limit in seconds to kill a stuck process')
// .action(async (pattern, opts) => {
//   if (!pattern.endsWith('.xml')) {
//     pattern += '.xml';
//   }
//   let { javaTests, lang } = opts;
//   if (javaTests === true) javaTests = 'src/test/java';
//   lang = lang?.toLowerCase();
//   const runReader = new XmlReader({ javaTests, lang });
//   const files = glob.sync(pattern, { cwd: opts.dir || process.cwd() });
//   if (!files.length) {
//     log.info( `Report can't be created. No XML files found 😥`);
//     process.exit(1);
//   }

program
  .command('xml')
  .description('Parse XML reports and upload to Testomat.io')
  .argument('<pattern>', 'XML file pattern')
  .option('-d, --dir <dir>', 'Project directory')
  .option('--java-tests [java-path]', 'Load Java tests from path, by default: src/test/java')
  .option('--lang <lang>', 'Language used (python, ruby, java)')
  .option('--timelimit <time>', 'default time limit in seconds to kill a stuck process')
  .action(async (pattern, opts) => {
    if (!pattern.endsWith('.xml') && !pattern.includes('*')) {
      pattern += '.xml';
    }
    let { javaTests, lang } = opts;
    if (javaTests === true) javaTests = 'src/test/java';
    lang = lang?.toLowerCase();
    const runReader = new XmlReader({ javaTests, lang });
    const files = glob.sync(pattern, { cwd: opts.dir || process.cwd() });
    if (!files.length) {
      log.info( `Report can't be created. No XML files found 😥`);
      process.exit(1);
    }

    for (const file of files) {
      log.info( `Parsed ${file}`);
      runReader.parse(file);
    }

    let timeoutTimer;
    if (opts.timelimit) {
      timeoutTimer = setTimeout(
        () => {
          console.log(
            `⚠️  Reached timeout of ${opts.timelimit}s. Exiting... (Exit code is 0 to not fail the pipeline)`,
          );
          process.exit(0);
        },
        parseInt(opts.timelimit, 10) * 1000,
      );
    }

    try {
      await runReader.createRun();
      await runReader.uploadData();
    } catch (err) {
      log.info( 'Error updating status, skipping...', err);
    }

    if (timeoutTimer) clearTimeout(timeoutTimer);
  });

program
  .command('upload-artifacts')
  .description('Upload artifacts to Testomat.io')
  .option('--force', 'Re-upload artifacts even if they were uploaded before')
  .action(async opts => {
    const apiKey = config.TESTOMATIO;

    process.env.TESTOMATIO_DISABLE_ARTIFACTS = '';
    const runId = process.env.TESTOMATIO_RUN || process.env.runId || readLatestRunId();

    if (!runId) {
      console.log('TESTOMATIO_RUN environment variable must be set or restored from a previous run.');
      return process.exit(1);
    }

    const client = new TestomatClient({
      apiKey,
      runId,
      isBatchEnabled: false,
    });

    let testruns = client.uploader.readUploadedFiles(runId);
    const numTotalArtifacts = testruns.length;

    debug('Found testruns:', testruns);

    if (!opts.force) testruns = testruns.filter(tr => !tr.uploaded);

    if (!testruns.length) {
      log.info( '🗄️ Total artifacts:', numTotalArtifacts);
      if (numTotalArtifacts) {
        log.info( 'No new artifacts to upload');
        log.info( 'To re-upload artifacts run this command with --force flag');
      }
      process.exit(0);
    }

    const testrunsByRid = testruns.reduce((acc, { rid, file }) => {
      if (!acc[rid]) {
        acc[rid] = [];
      }
      if (!acc[rid].includes(file)) acc[rid].push(file);
      return acc;
    }, {});

    await client.createRun();
    client.uploader.checkEnabled();
    client.uploader.disableLogStorage();

    for (const rid in testrunsByRid) {
      const files = testrunsByRid[rid];
      await client.addTestRun(undefined, { rid, files });
    }

    log.info( '🗄️', client.uploader.successfulUploads.length, 'artifacts 🟢uploaded');

    if (client.uploader.successfulUploads.length) {
      debug('\n', APP_PREFIX, `🗄️ ${client.uploader.successfulUploads.length} artifacts uploaded to S3 bucket`);
      const uploadedArtifacts = client.uploader.successfulUploads.map(file => ({
        relativePath: file.path.replace(process.cwd(), ''),
        link: file.link,
        sizePretty: prettyBytes(file.size, { round: 0 }).toString(),
      }));

      uploadedArtifacts.forEach(upload => {
        debug(
          `🟢Uploaded artifact`,
          `${upload.relativePath},`,
          'size:',
          `${upload.sizePretty},`,
          'link:',
          `${upload.link}`,
        );
      });
    }

    const filesizeStrMaxLength = 7;

    if (client.uploader.failedUploads.length) {
      console.log(
        '\n',
        APP_PREFIX,
        '🗄️',
        client.uploader.failedUploads.length,
        `artifacts 🔴${pc.bold('failed')} to upload`,
      );

      const failedUploads = client.uploader.failedUploads.map(({ path, size }) => ({
        relativePath: path.replace(process.cwd(), ''),
        sizePretty: prettyBytes(size, { round: 0 }).toString(),
      }));

      const pathPadding = Math.max(...failedUploads.map(upload => upload.relativePath.length)) + 1;
      failedUploads.forEach(upload => {
        console.log(
          `  ${pc.gray('|')} 🔴 ${upload.relativePath.padEnd(pathPadding)} ${pc.gray(
            `| ${upload.sizePretty.padStart(filesizeStrMaxLength)} |`,
          )}`,
        );
      });
    }
  });

program
  .command('replay')
  .description('Replay test data from debug file and re-send to Testomat.io')
  .argument('[debug-file]', `Path to debug file. Defaults to ./${DEBUG_FILE}.json`)
  .option('--dry-run', 'Preview the data without sending to Testomat.io')
  .action(async (debugFile, opts) => {
    try {
      const replayService = new Replay({
        apiKey: config.TESTOMATIO,
        dryRun: opts.dryRun,
        onLog: message => log.info( message),
        onError: message => log.error( '⚠️ ', message),
        onProgress: ({ current, total }) => {
          if (current % 10 === 0 || current === total) {
            log.info( `📊 Progress: ${current}/${total} tests processed`);
          }
        },
      });

      const result = await replayService.replay(debugFile);

      if (result.dryRun) {
        log.info(
          '🔍 Dry run completed:\n',
          `  - Tests found: ${result.testsCount}\n`,
          `  - Environment variables: ${Object.keys(result.envVars).length}\n`,
          '  - Run parameters:', result.runParams, '\n',
          '  Use without --dry-run to actually send the data',
        );
      } else {
        log.info( `✅ Successfully replayed ${result.successCount}/${result.testsCount} tests`);
        if (result.failureCount > 0) {
          log.info( `⚠️  ${result.failureCount} tests failed to upload`);
        }
      }

      process.exit(0);
    } catch (err) {
      log.error( '❌ Error replaying debug data:', err.message);
      if (err.message.includes('Debug file not found')) {
        log.error( '💡 Hint: Run tests with TESTOMATIO_DEBUG=1 to generate debug files');
      }
      process.exit(1);
    }
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
