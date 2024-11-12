#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const picocolors_1 = __importDefault(require("picocolors"));
const glob_1 = __importDefault(require("glob"));
const debug_1 = __importDefault(require("debug"));
const constants_js_1 = require("../constants.js");
const xmlReader_js_1 = __importDefault(require("../xmlReader.js"));
const package_json_1 = require("../../package.json");
const debug = (0, debug_1.default)('@testomatio/reporter:xml-cli');
console.log(picocolors_1.default.cyan(picocolors_1.default.bold(` 🤩 Testomat.io XML Reporter v${package_json_1.version}`)));
const program = new commander_1.Command();
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
        console.log(constants_js_1.APP_PREFIX, 'Loading env file:', opts.envFile);
        debug('Loading env file: %s', opts.envFile);
        require('dotenv').config({ path: opts.envFile }); // eslint-disable-line
    }
    if (javaTests === true)
        javaTests = 'src/test/java';
    lang = lang?.toLowerCase();
    const runReader = new xmlReader_js_1.default({ javaTests, lang });
    const files = glob_1.default.sync(pattern, { cwd: opts.dir || process.cwd() });
    if (!files.length) {
        console.log(constants_js_1.APP_PREFIX, `Report can't be created. No XML files found 😥`);
        process.exitCode = 1;
        return;
    }
    for (const file of files) {
        console.log(constants_js_1.APP_PREFIX, `Parsed ${file}`);
        runReader.parse(file);
    }
    let timeoutTimer;
    if (opts.timelimit) {
        timeoutTimer = setTimeout(() => {
            console.log(`⚠️  Reached timeout of ${opts.timelimit}s. Exiting... (Exit code is 0 to not fail the pipeline)`);
            process.exit(0);
        }, parseInt(opts.timelimit, 10) * 1000);
    }
    try {
        await runReader.createRun();
        await runReader.uploadData();
    }
    catch (err) {
        console.log(constants_js_1.APP_PREFIX, 'Error updating status, skipping...', err);
    }
    if (timeoutTimer)
        clearTimeout(timeoutTimer);
});
if (process.argv.length < 3) {
    program.outputHelp();
}
program.parse(process.argv);
