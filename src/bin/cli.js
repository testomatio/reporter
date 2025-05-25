#!/usr/bin/env node

import { Command } from 'commander';
import { spawn } from 'cross-spawn';
import { glob } from 'glob';
import createDebugMessages from 'debug';
import TestomatClient from '../client.js';
import XmlReader from '../xmlReader.js';
import { APP_PREFIX, STATUS } from '../constants.js';
import { getPackageVersion } from '../utils/utils.js';
import { config } from '../config.js';
import { readLatestRunId } from '../utils/utils.js';
import pc from 'picocolors';
import { filesize as prettyBytes } from 'filesize';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import os from 'os';

const debug = createDebugMessages('@testomatio/reporter:xml-cli');
const version = getPackageVersion();
console.log(pc.cyan(pc.bold(` 🤩 Testomat.io Reporter v${version}`)));
const program = new Command();

program
  .version(version)
  .option('--env-file <envfile>', 'Load environment variables from env file')
  .hook('preAction', thisCommand => {
    const opts = thisCommand.opts();
    if (opts.envFile) {
      dotenv.config({ path: opts.envFile });
    } else {
      dotenv.config();
    }
  });

program
  .command('start')
  .description('Start a new run and return its ID')
  .action(async () => {
    console.log('Starting a new Run on Testomat.io...');
    const apiKey = process.env['INPUT_TESTOMATIO-KEY'] || config.TESTOMATIO;
    const client = new TestomatClient({ apiKey });

    client.createRun().then(() => {
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
      console.log(pc.yellow(`Run ${process.env.TESTOMATIO_RUN} was finished`));
      process.exit(0);
    });
  });

program
  .command('run')
  .description('Run tests with the specified command')
  .argument('<command>', 'Test runner command')
  .option('--filter <filter>', 'Additional execution filter')
  .action(async (command, opts) => {
    const apiKey = process.env['INPUT_TESTOMATIO-KEY'] || config.TESTOMATIO;
    const title = process.env.TESTOMATIO_TITLE;

    if (!command || !command.split) {
      console.log(APP_PREFIX, `No command provided. Use -c option to launch a test runner.`);
      return process.exit(255);
    }

    const client = new TestomatClient({ apiKey, title, parallel: true });

    if (opts.filter) {
      const [pipe, ...optsArray] = opts.filter.split(':');
      const pipeOptions = optsArray.join(':');

      try {
        const tests = await client.prepareRun({ pipe, pipeOptions });
        if (tests && tests.length > 0) {
          command += ` --grep (${tests.join('|')})`;
        }
      } catch (err) {
        console.log(APP_PREFIX, err);
      }
    }

    console.log(APP_PREFIX, `🚀 Running`, pc.green(command));

    const runTests = () => {
      const testCmds = command.split(' ');
      const cmd = spawn(testCmds[0], testCmds.slice(1), { stdio: 'inherit' });

      cmd.on('close', code => {
        const emoji = code === 0 ? '🟢' : '🔴';
        console.log(APP_PREFIX, emoji, `Runner exited with ${pc.bold(code)}`);
        if (apiKey) {
          const status = code === 0 ? 'passed' : 'failed';
          client.updateRunStatus(status, true);
        }
        process.exit(code);
      });
    };

    if (apiKey) {
      client.createRun().then(runTests);
    } else {
      runTests();
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
//     console.log(APP_PREFIX, `Report can't be created. No XML files found 😥`);
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
    if (!pattern.endsWith('.xml')) {
      pattern += '.xml';
    }
    let { javaTests, lang } = opts;
    if (javaTests === true) javaTests = 'src/test/java';
    lang = lang?.toLowerCase();
    const runReader = new XmlReader({ javaTests, lang });
    const files = glob.sync(pattern, { cwd: opts.dir || process.cwd() });
    if (!files.length) {
      console.log(APP_PREFIX, `Report can't be created. No XML files found 😥`);
      process.exit(1);
    }

    for (const file of files) {
      console.log(APP_PREFIX, `Parsed ${file}`);
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
      console.log(APP_PREFIX, 'Error updating status, skipping...', err);
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
      console.log(APP_PREFIX, '🗄️ Total artifacts:', numTotalArtifacts);
      if (numTotalArtifacts) {
        console.log(APP_PREFIX, 'No new artifacts to upload');
        console.log(APP_PREFIX, 'To re-upload artifacts run this command with --force flag');
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

    console.log(APP_PREFIX, '🗄️', client.uploader.successfulUploads.length, 'artifacts 🟢uploaded');

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
  .argument('[debug-file]', 'Path to debug file (defaults to /tmp/testomatio.debug.latest.json)')
  .action(async (debugFile, opts) => {
    // Use default debug file if none provided
    if (!debugFile) {
      debugFile = path.join(os.tmpdir(), 'testomatio.debug.latest.json');
    }

    if (!fs.existsSync(debugFile)) {
      console.log(APP_PREFIX, `❌ Debug file not found: ${debugFile}`);
      return process.exit(1);
    }

    console.log(APP_PREFIX, `🪲 Replaying data from debug file: ${debugFile}`);

    try {
      const fileContent = fs.readFileSync(debugFile, 'utf-8');
      const lines = fileContent.trim().split('\n').filter(Boolean);

      if (lines.length === 0) {
        console.log(APP_PREFIX, '❌ Debug file is empty');
        return process.exit(1);
      }

      let runParams = {};
      let finishParams = {};
      let parseErrors = 0;
      const allTests = [];

      // Parse debug file line by line
      for (const [lineIndex, line] of lines.entries()) {
        try {
          const logEntry = JSON.parse(line);

          if (logEntry.data === 'variables' && logEntry.testomatioEnvVars) {
            Object.assign(process.env, logEntry.testomatioEnvVars, process.env);
          } else if (logEntry.action === 'createRun') {
            runParams = logEntry.params || {};
          } else if (logEntry.action === 'addTestsBatch' && logEntry.tests) {
            allTests.push(...logEntry.tests);
          } else if (logEntry.action === 'addTest' && logEntry.testId) {
            allTests.push(logEntry.testId);
          } else if (logEntry.actions === 'finishRun') {
            finishParams = logEntry.params || {};
          }
        } catch (err) {
          parseErrors++;
          if (parseErrors <= 3) {
            // Only show first 3 parse errors
            console.warn(APP_PREFIX, `⚠️  Failed to parse line ${lineIndex + 1}: ${line.substring(0, 100)}...`);
          }
        }
      }

      if (parseErrors > 3) {
        console.warn(APP_PREFIX, `⚠️  ${parseErrors - 3} more parse errors occurred`);
      }

      console.log(APP_PREFIX, `📊 Found ${allTests.length} tests to replay`);

      if (allTests.length === 0) {
        console.log(APP_PREFIX, '❌ No test data found in debug file');
        return process.exit(1);
      }

      const apiKey = config.TESTOMATIO;
      if (!apiKey) {
        console.log(APP_PREFIX, '❌ TESTOMATIO API key not found. Set TESTOMATIO environment variable.');
        return process.exit(1);
      }

      // Create client and restore the run
      const client = new TestomatClient({
        apiKey,
        isBatchEnabled: true,
        ...runParams,
      });

      console.log(APP_PREFIX, '🚀 Publishing to run...');
      await client.createRun(runParams);

      // Send each test result - let client.js handle the data mapping and formatting
      for (const [index, test] of allTests.entries()) {
        try {
          await client.addTestRun(test.status, test);
        } catch (err) {
          console.warn(APP_PREFIX, `⚠️  Failed to send test ${index + 1}: ${err.message}`);
        }
      }

      await client.updateRunStatus(finishParams.status || STATUS.FINISHED, finishParams.parallel || false);

      console.log(APP_PREFIX, `✅ Successfully replayed ${allTests.length} tests from debug file`);
      process.exit(0);
    } catch (err) {
      console.error(APP_PREFIX, '❌ Error replaying debug data:', err.message);
      console.error(err.stack);
      process.exit(1);
    }
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
