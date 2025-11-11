#!/usr/bin/env node
import { Command } from 'commander';
import pc from 'picocolors';
import { glob } from 'glob';
import createDebugMessages from 'debug';
import { APP_PREFIX } from '../constants.js';
import XmlReader from '../xmlReader.js';
import { getPackageVersion } from '../utils/utils.js';
import dotenv from 'dotenv';
import path from 'path';

const version = getPackageVersion();

const debug = createDebugMessages('@testomatio/reporter:xml-cli');
console.log(pc.cyan(pc.bold(` 🤩 Testomat.io XML Reporter v${version}`)));
const program = new Command();

program
  .arguments('<pattern>')
  .option('-d, --dir <dir>', 'Project directory')
  .option('--java-tests [java-path]', 'Load Java tests from path, by default: src/test/java')
  .option('--lang <lang>', 'Language used (python, ruby, java)')
  .option('--timelimit <time>', 'default time limit in seconds to kill a stuck process')
  .option('--env-file <envfile>', 'Load environment variables from env file')
  .action(async (pattern, opts) => {
    if (!pattern.endsWith('.xml') && !pattern.includes('*')) {
      pattern += '.xml';
    }
    let { javaTests, lang } = opts;
    if (opts.envFile) {
      console.log(APP_PREFIX, 'Loading env file:', opts.envFile);
      debug('Loading env file: %s', opts.envFile);
      dotenv.config({ path: opts.envFile });
    }
    lang = lang?.toLowerCase();
    if (javaTests === true || (lang === 'java' && !javaTests)) javaTests = 'src/test/java';
    const runReader = new XmlReader({
      javaTests,
      lang,
    });
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
