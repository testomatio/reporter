#!/usr/bin/env node
const program = require('commander');
const chalk = require('chalk');
const glob = require('glob');
const debug = require('debug')('@testomatio/reporter:xml-cli');
const { APP_PREFIX } = require('../constants');
const XmlReader = require('../xmlReader');

const { version } = require('../../package.json');

console.log(chalk.cyan.bold(` 🤩 Testomat.io XML Reporter v${version}`));

program
  .arguments('<pattern>')
  .option('-d, --dir <dir>', 'Project directory')
  .option('--java-tests [java-path]', 'Load Java tests from path, by default: src/test/java')
  .option('--lang <lang>', 'Language used (python, ruby, java)')
  .option('--timelimit <time>', 'default time limit in seconds to kill a stuck process')
  .option('--env-file <envfile>', 'Load environment variables from env file')
  .action(async (pattern, opts) => {
    if (!pattern.endsWith('.xml')) {
      pattern += '.xml';
    }
    let { javaTests, lang } = opts;
    if (opts.envFile) {
      console.log(APP_PREFIX, 'Loading env file:', opts.envFile);
      debug('Loading env file: %s', opts.envFile);
      require('dotenv').config({ path: opts.envFile }); // eslint-disable-line
    }
    if (javaTests === true) javaTests = 'src/test/java';
    lang = lang?.toLowerCase();
    const runReader = new XmlReader({ javaTests, lang });
    const files = glob.sync(pattern, { cwd: opts.dir || process.cwd() });
    if (!files.length) {
      console.log(APP_PREFIX, `Report can't be created. No XML files found 😥`);
      process.exitCode = 1;
      return;
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

if (process.argv.length < 3) {
  program.outputHelp();
}

program.parse(process.argv);
