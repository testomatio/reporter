#!/usr/bin/env node
const { program } = require('commander');
const spawn = require('cross-spawn');
const chalk = require('chalk');
const glob = require('glob');
const debug = require('debug')('@testomatio/reporter:cli');
const TestomatClient = require('../client');
const XmlReader = require('../xmlReader');
const { APP_PREFIX, STATUS } = require('../constants');
const { version } = require('../../package.json');
const config = require('../config');
const { readLatestRunId } = require('../utils/utils');
const { filesize: prettyBytes } = require('filesize');

console.log(chalk.cyan.bold(` 🤩 Testomat.io Reporter v${version}`));

program
  .version(version)
  .option('--env-file <envfile>', 'Load environment variables from env file')
  .hook('preAction', thisCommand => {
    const opts = thisCommand.opts();
    if (opts.envFile) {
      require('dotenv').config({ path: opts.envFile });
    } else {
      require('dotenv').config();
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

    client.updateRunStatus(STATUS.FINISHED).then(() => {
      console.log(chalk.yellow(`Run ${process.env.TESTOMATIO_RUN} was finished`));
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

    console.log(APP_PREFIX, `🚀 Running`, chalk.green(command));

    const runTests = () => {
      const testCmds = command.split(' ');
      const cmd = spawn(testCmds[0], testCmds.slice(1), { stdio: 'inherit' });

      cmd.on('close', code => {
        const emoji = code === 0 ? '🟢' : '🔴';
        console.log(APP_PREFIX, emoji, `Runner exited with ${chalk.bold(code)}`);
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

    console.log(APP_PREFIX, '🗄️', client.uploader.totalSuccessfulUploadsCount, 'artifacts 🟢uploaded');
    const filesizeStrMaxLength = 7;

    if (client.uploader.failedUploads.length) {
      console.log(
        '\n',
        APP_PREFIX,
        '🗄️',
        client.uploader.failedUploads.length,
        `artifacts 🔴${chalk.bold('failed')} to upload`,
      );

      const failedUploads = client.uploader.failedUploads.map(({ path, size }) => ({
        relativePath: path.replace(process.cwd(), ''),
        sizePretty: prettyBytes(size, { round: 0 }).toString(),
      }));

      const pathPadding = Math.max(...failedUploads.map(upload => upload.relativePath.length)) + 1;
      failedUploads.forEach(upload => {
        console.log(
          `  ${chalk.gray('|')} 🔴 ${upload.relativePath.padEnd(pathPadding)} ${chalk.gray(
            `| ${upload.sizePretty.padStart(filesizeStrMaxLength)} |`,
          )}`,
        );
      });
    }
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
