#!/usr/bin/env node

import { Command } from 'commander';
import { spawn } from 'cross-spawn';
import { glob } from 'glob';
import createDebugMessages from 'debug';
import TestomatClient from '../client.js';
import XmlReader from '../xmlReader.js';
import AllureReader from '../allureReader.js';
import { APP_PREFIX, STATUS, DEBUG_FILE, BATCH_MODE } from '../constants.js';
import { cleanLatestRunId, getPackageVersion, applyFilter, transformEnvVarToBoolean } from '../utils/utils.js';
import { config } from '../config.js';
import { readLatestRunId } from '../utils/utils.js';
import pc from 'picocolors';
import { filesize as prettyBytes } from 'filesize';
import dotenv from 'dotenv';
import Replay from '../replay.js';
import { log } from '../utils/log.js';
import { formatFilterListIds, formatRunOutput, formatFetchRunsOutput } from '../utils/pipe_utils.js';
import fs from 'fs';
import path from 'path';

const debug = createDebugMessages('@testomatio/reporter:cli');
const version = getPackageVersion();
const program = new Command();

const FETCH_RUNS_DEFAULT_LIMIT = 30;
const FETCH_RUNS_MAX_LIMIT = 100;

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

    // --format / --filter-list produce machine-readable output on stdout, so route
    // remaining output to stderr, skip the banner, and silence info-level logs so
    // stdout stays clean for capture (e.g. RUN_ID=$(... start --format id)).
    // Set TESTOMATIO_LOG_LEVEL=INFO to re-enable progress logs for debugging.
    const subOpts = actionCommand.opts();
    if (subOpts.filterList || subOpts.format) {
      process.env.TESTOMATIO_LOG_STDERR = '1';
      process.env.TESTOMATIO_LOG_LEVEL ||= 'WARN';
      // with --format json the logs are machine-readable too: one JSON object per line on stderr
      if (subOpts.format === 'json') process.env.TESTOMATIO_LOG_JSON = '1';
    } else {
      console.log(pc.cyan(pc.bold(` 🤩 Testomat.io Reporter v${version}`)));
    }
  });

program
  .command('start')
  .description('Start a new run and return its ID')
  .option('--kind <type>', 'Specify run type: automated, manual, mixed, or detect')
  .option('--filter <filter>', 'Scope the prepared run to tests matching the filter (no execution)')
  .option('--format <format>', 'Machine-readable output: the run id (--format id) or run details (--format json)')
  .option('--warn', 'Exit 0 instead of 1 when the filter matches no tests (warn only)')
  .action(async opts => {
    cleanLatestRunId();

    log.info('Starting a new Run on Testomat.io...');
    const apiKey = process.env['INPUT_TESTOMATIO-KEY'] || config.TESTOMATIO;
    const client = new TestomatClient({ apiKey });

    // nothing is executed yet; the server flips it to running on the first reported test
    const createRunParams = { status: 'scheduled' };
    if (opts.kind) createRunParams.kind = opts.kind;

    if (opts.filter) {
      const [pipe, ...optsArray] = opts.filter.split(':');
      const tests = await client.prepareRun({ pipe, pipeOptions: optsArray.join(':') });
      if (!tests || tests.length === 0) {
        log.warn(pc.yellow('No tests found for the filter. Run not created.'));
        // --warn treats an empty match as a normal outcome (e.g. a PR touching no mapped files)
        process.exit(opts.warn ? 0 : 1);
      }
      createRunParams.configuration = {
        tests: tests.filter(id => id.startsWith('T')).map(id => id.slice(1)),
        suites: tests.filter(id => id.startsWith('S')).map(id => id.slice(1)),
      };
    }

    await client.createRun(createRunParams);

    const runId = client.pipeStore.runId;
    if (!runId) {
      log.error(pc.red('Failed to create run on Testomat.io.'));
      process.exit(1);
    }

    // tests are executed later, so report the run as pending with the tests it was scoped to:
    // pipes add their report now and replace it when the run is finished
    const plannedTests = (client.pipeStore.preparedTestIds || []).map(id => ({ test_id: id, title: id }));
    await client.updateRunStatus('pending', { tests: plannedTests });

    // stdout carries ONLY the run data so it can be captured: RUN_ID=$(reporter start)
    console.log(formatRunOutput(client.pipeStore, opts.format));
    process.exit(0);
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

    const finishParams = {};
    if (transformEnvVarToBoolean(process.env.TESTOMATIO_FINISH_SHARED_RUN)) finishParams.force_finish_shared_run = true;

    // @ts-ignore
    client.updateRunStatus(STATUS.FINISHED, finishParams).then(() => {
      process.exit(0);
    });
  });

program
  .command('fetch')
  .description('Fetch runs from Testomat.io API v2')
  .option('--project <slug>', 'Project slug (or set TESTOMATIO_PROJECT)')
  .option('--title <text>', 'Filter by run title')
  .option('--tql <query>', 'Filter using Testomat Query Language')
  .option('--rungroup <uid>', 'Filter by rungroup id')
  .option(
    '--limit <number>',
    `Max number of runs to return (max ${FETCH_RUNS_MAX_LIMIT})`,
    String(FETCH_RUNS_DEFAULT_LIMIT),
  )
  .option('--latest', 'Only fetch the most recent run (shorthand for --limit 1)')
  .option(
    '--format <format>',
    'Machine-readable output: run ids, one per line (--format id) or run details (--format json)',
  )
  .action(async opts => {
    const apiKey = process.env['INPUT_TESTOMATIO-KEY'] || config.TESTOMATIO;
    if (!apiKey) {
      log.error(pc.red('⚠️  TESTOMATIO API key required'));
      process.exit(1);
    }

    const project = opts.project || process.env.TESTOMATIO_PROJECT;
    if (!project) {
      log.error(pc.red('⚠️  --project (or TESTOMATIO_PROJECT) is required'));
      process.exit(1);
    }

    const baseUrl = process.env.TESTOMATIO_URL || 'https://app.testomat.io';
    const url = new URL(`/api/v2/${project}/runs`, baseUrl);
    if (opts.title) url.searchParams.set('search', opts.title);
    if (opts.tql) url.searchParams.set('tql', opts.tql);
    if (opts.rungroup) url.searchParams.set('groupId', opts.rungroup);
    const requestedLimit = opts.latest ? 1 : parseInt(opts.limit, 10) || FETCH_RUNS_DEFAULT_LIMIT;
    const limit = Math.min(Math.max(requestedLimit, 1), FETCH_RUNS_MAX_LIMIT);
    url.searchParams.set('per_page', String(limit));

    const response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
    const body = await response.json();

    if (!response.ok) {
      log.error(pc.red(`Failed to fetch runs: ${response.status} ${body.error || response.statusText}`));
      process.exit(1);
    }

    console.log(formatFetchRunsOutput(body, opts.format));
  });

program
  .command('run')
  .alias('test')
  .description('Run tests with the specified command')
  .argument('[command]', 'Test runner command')
  .option('--filter <filter>', 'Additional execution filter')
  .option('--filter-list <filter>', 'Get a list of all tests by filter before running')
  .option(
    '--format <format>',
    'Machine-readable output: test ids for --filter-list (grep, json, newline, ids), or the run created (id, json)',
  )
  .option('--kind <type>', 'Specify run type: automated, manual, mixed, or detect')
  .option('--remote <profile>', 'Trigger run on the named Testomat.io CI profile instead of executing locally')
  .option(
    '--remote-param <kv>',
    'key=value pair forwarded to the CI profile config (repeat for multiple)',
    (value, prev) => prev.concat([value]),
    [],
  )
  .option('--warn', 'Exit 0 instead of 1 when the filter matches no tests (warn only)')
  .action(async (command, opts) => {
    if (opts.remote) {
      if (opts.filterList) {
        log.warn(pc.red('⚠️  --filter-list cannot be combined with --remote'));
        process.exit(1);
      }
      process.env.TESTOMATIO_CI_PROFILE = opts.remote;
      if (opts.remoteParam?.length) {
        process.env.TESTOMATIO_CI_PARAMS = opts.remoteParam.join(',');
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
          // via $? and skip launching the runner. --warn downgrades it to 0.
          if (opts.filterList && !opts.warn) process.exit(1);
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
        log.error(pc.red(`CI launch failed: ${err.message || err}`));
        process.exit(1);
      }

      // createRun swallows pipe-level errors, so a resolved promise is not proof
      // the launch succeeded — the pipe only records runUrl on a real 2xx response.
      if (!client.pipeStore.runUrl) {
        log.error(pc.red('CI launch failed — no run was created (see the error above).'));
        process.exit(1);
      }

      log.info(`🚀 CI build triggered on profile ${pc.cyan(opts.remote)}`);
      log.info(`📊 Report URL: ${pc.magenta(client.pipeStore.runUrl)}`);
      const remoteOutput = formatRunOutput(client.pipeStore, opts.format);
      if (opts.format && remoteOutput) console.log(remoteOutput);
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

        const runId = client.pipeStore.runId;
        if (!runId) {
          log.error(pc.red('Failed to create run on Testomat.io.'));
          process.exit(1);
        }

        if (client.pipeStore.runUrl) log.info( `📊 Report URL: ${pc.magenta(client.pipeStore.runUrl)}`);

        if (opts.kind !== 'manual') {
          log.info( `No command passed, so you need to run tests yourself:`);
          log.info( `TESTOMATIO_RUN=${runId} <command>`);
        }
        if (opts.format) console.log(formatRunOutput(client.pipeStore, opts.format));
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
      await client.createRun(createRunParams);
      // the runner inherits stdout, so the run data is printed first, on its own line
      const createdOutput = formatRunOutput(client.pipeStore, opts.format);
      if (opts.format && createdOutput) console.log(createdOutput);
      await runTests();
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
  .command('allure')
  .description('Parse Allure result files and upload to Testomat.io')
  .argument('<pattern>', 'Allure result directory pattern')
  .option('-d, --dir <dir>', 'Project directory')
  .option('--timelimit <time>', 'default time limit in seconds to kill a stuck process')
  .option('--with-package', 'Keep full package path in file names (default: strip package prefix)')
  .option(
    '--java-tests [path]',
    'Path to test sources; links cases from @TmsLink in source for skipped tests (default: src/test)',
  )
  .option('--lang <lang>', 'Language used (java, kotlin, ...)')
  .action(async (pattern, opts) => {
    let javaTests = opts.javaTests;
    if (javaTests === true) javaTests = 'src/test';

    const runReader = new AllureReader({ withPackage: opts.withPackage, javaTests, lang: opts.lang });

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
      await runReader.parse(pattern);
      await runReader.createRun();
      await runReader.uploadData();
    } catch (err) {
      console.log(APP_PREFIX, 'Error uploading Allure results:', err);
    }

    if (timeoutTimer) clearTimeout(timeoutTimer);
  });

program
  .command('upload-artifacts')
  .description('Upload artifacts to Testomat.io')
  .argument('[jsonl-file]', 'Path to JSONL debug file (optional)')
  .option('--force', 'Re-upload artifacts even if they were uploaded before')
  .action(async (jsonlFile, opts) => {
    const apiKey = config.TESTOMATIO;

    // JSONL file mode: upload artifacts from debug file
    if (jsonlFile) {
      if (!fs.existsSync(jsonlFile)) {
        log.error(`JSONL file not found: ${jsonlFile}`);
        return process.exit(1);
      }

      const replay = new Replay({ apiKey });
      const { tests, runId } = replay.parseDebugFile(jsonlFile);

      if (!runId) {
        log.error('runId not found in JSONL file');
        return process.exit(1);
      }

      log.info(`Processing ${tests.length} tests from ${jsonlFile}`);

      const client = new TestomatClient({
        apiKey,
        runId,
        batchMode: BATCH_MODE.DISABLED,
      });

      await client.createRun();
      client.uploader.checkEnabled();
      client.uploader.disableLogStorage();

      let uploadedCount = 0;
      let failedCount = 0;

      for (const test of tests) {
        if (!hasExistingArtifacts(test)) continue;

        try {
          await client.addTestRun(undefined, { ...test, overwrite: true });
          uploadedCount++;
        } catch (e) {
          log.error(`Failed ${test.test_id || test.rid || test.title}: ${e.message}`);
          failedCount++;
        }
      }

      log.info(`🗄️ ${uploadedCount} tests with artifacts uploaded`);
      if (failedCount > 0) {
        log.warn(`⚠️ ${failedCount} tests failed to upload artifacts`);
      }
      return;
    }

    process.env.TESTOMATIO_DISABLE_ARTIFACTS = '';
    const runId = process.env.TESTOMATIO_RUN || process.env.runId || readLatestRunId();

    if (!runId) {
      console.log('TESTOMATIO_RUN environment variable must be set or restored from a previous run.');
      return process.exit(1);
    }

    const client = new TestomatClient({
      apiKey,
      runId,
      batchMode: BATCH_MODE.DISABLED,
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

function hasExistingArtifacts(test) {
  const hasExistingFile = items => {
    for (const item of items || []) {
      const artifactPath = typeof item === 'object' ? item?.path : item;
      if (artifactPath && fs.existsSync(artifactPath)) return true;
    }
    return false;
  };

  if (hasExistingFile(test.files)) return true;

  const stack = [...(test.steps || [])];
  while (stack.length) {
    const step = stack.pop();
    if (!step) continue;
    if (hasExistingFile(step.artifacts)) return true;
    if (Array.isArray(step.steps)) stack.push(...step.steps);
  }

  return false;
}

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
