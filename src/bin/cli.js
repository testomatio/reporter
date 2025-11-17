#!/usr/bin/env node

import { Command } from 'commander';
import { spawn } from 'cross-spawn';
import { glob } from 'glob';
import createDebugMessages from 'debug';
import TestomatClient from '../client.js';
import XmlReader from '../xmlReader.js';
import { APP_PREFIX, STATUS } from '../constants.js';
import { cleanLatestRunId, getPackageVersion } from '../utils/utils.js';
import { config } from '../config.js';
import { readLatestRunId } from '../utils/utils.js';
import pc from 'picocolors';
import { filesize as prettyBytes } from 'filesize';
import dotenv from 'dotenv';
import Replay from '../replay.js';

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
  .argument('<command>', 'Test runner command')
  .option('--filter <filter>', 'Additional execution filter')
  .option('--kind <type>', 'Specify run type: automated, manual, or mixed')
  .action(async (command, opts) => {
    const apiKey = process.env['INPUT_TESTOMATIO-KEY'] || config.TESTOMATIO;
    const title = process.env.TESTOMATIO_TITLE;

    if (!command || !command.split) {
      console.log(APP_PREFIX, `No command provided. Use -c option to launch a test runner.`);
      return process.exit(255);
    }

    const client = new TestomatClient({ apiKey, title });

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

    const runTests = async () => {
      const testCmds = command.split(' ');
      const cmd = spawn(testCmds[0], testCmds.slice(1), {
        stdio: 'inherit',
        env: { ...process.env, TESTOMATIO_PROCEED: 'true', runId: client.runId },
      });

      cmd.on('close', async code => {
        const emoji = code === 0 ? '🟢' : '🔴';
        console.log(APP_PREFIX, emoji, `Runner exited with ${pc.bold(code)}`);
        if (apiKey) {
          const status = code === 0 ? 'passed' : 'failed';
          await client.updateRunStatus(status);
        }
        process.exit(code);
      });
    };

    const createRunParams = {};
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
    if (!pattern.endsWith('.xml') && !pattern.includes('*')) {
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
  .option('--dry-run', 'Preview the data without sending to Testomat.io')
  .action(async (debugFile, opts) => {
    try {
      const replayService = new Replay({
        apiKey: config.TESTOMATIO,
        dryRun: opts.dryRun,
        onLog: message => console.log(APP_PREFIX, message),
        onError: message => console.error(APP_PREFIX, '⚠️ ', message),
        onProgress: ({ current, total }) => {
          if (current % 10 === 0 || current === total) {
            console.log(APP_PREFIX, `📊 Progress: ${current}/${total} tests processed`);
          }
        },
      });

      const result = await replayService.replay(debugFile);

      if (result.dryRun) {
        console.log(APP_PREFIX, '🔍 Dry run completed:');
        console.log(APP_PREFIX, `  - Tests found: ${result.testsCount}`);
        console.log(APP_PREFIX, `  - Environment variables: ${Object.keys(result.envVars).length}`);
        console.log(APP_PREFIX, `  - Run parameters:`, result.runParams);
        console.log(APP_PREFIX, '  Use without --dry-run to actually send the data');
      } else {
        console.log(APP_PREFIX, `✅ Successfully replayed ${result.successCount}/${result.testsCount} tests`);
        if (result.failureCount > 0) {
          console.log(APP_PREFIX, `⚠️  ${result.failureCount} tests failed to upload`);
        }
      }

      process.exit(0);
    } catch (err) {
      console.error(APP_PREFIX, '❌ Error replaying debug data:', err.message);
      if (err.message.includes('Debug file not found')) {
        console.error(APP_PREFIX, '💡 Hint: Run tests with TESTOMATIO_DEBUG=1 to generate debug files');
      }
      process.exit(1);
    }
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
