#!/usr/bin/env node
const program = require("commander");
// const chalk = require("chalk");
const glob = require('glob');

const { APP_PREFIX } = require('../constants');
const XmlReader = require("../xmlReader");

// const apiKey = process.env['INPUT_TESTOMATIO-KEY'] || process.env.TESTOMATIO;
// const title = process.env.TESTOMATIO_TITLE;

// console.log(chalk.cyan.bold(` 🤩 xmlReader by Testomat.io v${version}`));

program
  .arguments("<pattern>")
  .option("-d, --dir <dir>", "Project directory")
  .option("--java-tests [java-path]", "Load Java tests from path, by default: src/test/java")
  .option("--lang <lang>", "Language used (python, ruby, java)")
  .action(async (pattern, opts) => {
    if (!pattern.endsWith('.xml')) {
      pattern += '.xml';
    }
    let { javaTests, lang } = opts;
    if (javaTests === true) javaTests = 'src/test/java';
    const runReader = new XmlReader({ javaTests, lang });
    const files = glob.sync(pattern, { cwd: opts.dir || process.cwd() });
    if (!files.length) {
      console.log(APP_PREFIX,`Report can't be created. No XML files found 😥`);
      process.exitCode = 1;
      return;
    }

    for (const file of files) {
      console.log(APP_PREFIX,`Parsed ${file}`);
      runReader.parse(file);
    }
    try {
      await runReader.createRun();
      await runReader.uploadData();
    } catch (err) {
      console.log(APP_PREFIX, 'Error updating status, skipping...', err);
    }
  });


if (process.argv.length < 1) {
  program.outputHelp();
}

program.parse(process.argv);
