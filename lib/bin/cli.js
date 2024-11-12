#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const cross_spawn_1 = require("cross-spawn");
const glob_1 = __importDefault(require("glob"));
const debug_1 = __importDefault(require("debug"));
const client_js_1 = __importDefault(require("../client.js"));
const xmlReader_js_1 = __importDefault(require("../xmlReader.js"));
const constants_js_1 = require("../constants.js");
const package_json_1 = require("../../package.json");
const config_js_1 = require("../config.js");
const utils_js_1 = require("../utils/utils.js");
const picocolors_1 = __importDefault(require("picocolors"));
const debug = (0, debug_1.default)('@testomatio/reporter:xml-cli');
console.log(picocolors_1.default.cyan(picocolors_1.default.bold(` 🤩 Testomat.io Reporter v${package_json_1.version}`)));
const program = new commander_1.Command();
program
    .version(package_json_1.version)
    .option('--env-file <envfile>', 'Load environment variables from env file')
    .hook('preAction', thisCommand => {
    const opts = thisCommand.opts();
    if (opts.envFile) {
        require('dotenv').config({ path: opts.envFile });
    }
    else {
        require('dotenv').config();
    }
});
program
    .command('start')
    .description('Start a new run and return its ID')
    .action(async () => {
    console.log('Starting a new Run on Testomat.io...');
    const apiKey = process.env['INPUT_TESTOMATIO-KEY'] || config_js_1.config.TESTOMATIO;
    const client = new client_js_1.default({ apiKey });
    client.createRun().then(() => {
        console.log(process.env.runId);
        process.exit(0);
    });
});
program
    .command('finish')
    .description('Finish Run by its ID')
    .action(async () => {
    process.env.TESTOMATIO_RUN ||= (0, utils_js_1.readLatestRunId)();
    if (!process.env.TESTOMATIO_RUN) {
        console.log('TESTOMATIO_RUN environment variable must be set or restored from a previous run.');
        return process.exit(1);
    }
    console.log('Finishing Run on Testomat.io...');
    const apiKey = process.env['INPUT_TESTOMATIO-KEY'] || config_js_1.config.TESTOMATIO;
    const client = new client_js_1.default({ apiKey });
    // @ts-ignore
    client.updateRunStatus(constants_js_1.STATUS.FINISHED).then(() => {
        console.log(picocolors_1.default.yellow(`Run ${process.env.TESTOMATIO_RUN} was finished`));
        process.exit(0);
    });
});
program
    .command('run')
    .description('Run tests with the specified command')
    .argument('<command>', 'Test runner command')
    .option('--filter <filter>', 'Additional execution filter')
    .action(async (command, opts) => {
    const apiKey = process.env['INPUT_TESTOMATIO-KEY'] || config_js_1.config.TESTOMATIO;
    const title = process.env.TESTOMATIO_TITLE;
    if (!command || !command.split) {
        console.log(constants_js_1.APP_PREFIX, `No command provided. Use -c option to launch a test runner.`);
        return process.exit(255);
    }
    const client = new client_js_1.default({ apiKey, title, parallel: true });
    if (opts.filter) {
        const [pipe, ...optsArray] = opts.filter.split(':');
        const pipeOptions = optsArray.join(':');
        try {
            const tests = await client.prepareRun({ pipe, pipeOptions });
            if (tests && tests.length > 0) {
                command += ` --grep (${tests.join('|')})`;
            }
        }
        catch (err) {
            console.log(constants_js_1.APP_PREFIX, err);
        }
    }
    console.log(constants_js_1.APP_PREFIX, `🚀 Running`, picocolors_1.default.green(command));
    const runTests = () => {
        const testCmds = command.split(' ');
        const cmd = (0, cross_spawn_1.spawn)(testCmds[0], testCmds.slice(1), { stdio: 'inherit' });
        cmd.on('close', code => {
            const emoji = code === 0 ? '🟢' : '🔴';
            console.log(constants_js_1.APP_PREFIX, emoji, `Runner exited with ${picocolors_1.default.bold(code)}`);
            if (apiKey) {
                const status = code === 0 ? 'passed' : 'failed';
                client.updateRunStatus(status, true);
            }
            process.exit(code);
        });
    };
    if (apiKey) {
        client.createRun().then(runTests);
    }
    else {
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
    if (javaTests === true)
        javaTests = 'src/test/java';
    lang = lang?.toLowerCase();
    const runReader = new xmlReader_js_1.default({ javaTests, lang });
    const files = glob_1.default.sync(pattern, { cwd: opts.dir || process.cwd() });
    if (!files.length) {
        console.log(constants_js_1.APP_PREFIX, `Report can't be created. No XML files found 😥`);
        process.exit(1);
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
program
    .command('upload-artifacts')
    .description('Upload artifacts to Testomat.io')
    .option('--force', 'Re-upload artifacts even if they were uploaded before')
    .action(async (opts) => {
    const apiKey = config_js_1.config.TESTOMATIO;
    process.env.TESTOMATIO_DISABLE_ARTIFACTS = '';
    const runId = process.env.TESTOMATIO_RUN || process.env.runId || (0, utils_js_1.readLatestRunId)();
    if (!runId) {
        console.log('TESTOMATIO_RUN environment variable must be set or restored from a previous run.');
        return process.exit(1);
    }
    const client = new client_js_1.default({
        apiKey,
        runId,
        isBatchEnabled: false,
    });
    let testruns = client.uploader.readUploadedFiles(runId);
    const numTotalArtifacts = testruns.length;
    debug('Found testruns:', testruns);
    if (!opts.force)
        testruns = testruns.filter(tr => !tr.uploaded);
    if (!testruns.length) {
        console.log(constants_js_1.APP_PREFIX, 'Total artifacts:', numTotalArtifacts);
        if (numTotalArtifacts) {
            console.log(constants_js_1.APP_PREFIX, 'No new artifacts to upload');
            console.log(constants_js_1.APP_PREFIX, 'To re-upload artifacts run this command with --force flag');
        }
        process.exit(0);
    }
    const testrunsByRid = testruns.reduce((acc, { rid, file }) => {
        if (!acc[rid]) {
            acc[rid] = [];
        }
        if (!acc[rid].includes(file))
            acc[rid].push(file);
        return acc;
    }, {});
    await client.createRun();
    client.uploader.checkEnabled();
    client.uploader.disbleLogStorage();
    for (const rid in testrunsByRid) {
        const files = testrunsByRid[rid];
        await client.addTestRun(undefined, { rid, files });
    }
    console.log(constants_js_1.APP_PREFIX, client.uploader.totalUploadsCount, 'artifacts uploaded');
    if (client.uploader.failedUploadsCount) {
        console.log(constants_js_1.APP_PREFIX, client.uploader.failedUploadsCount, 'artifacts failed to upload');
    }
});
program.parse(process.argv);
if (!process.argv.slice(2).length) {
    program.outputHelp();
}
