#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cross_spawn_1 = require("cross-spawn");
const commander_1 = require("commander");
const picocolors_1 = __importDefault(require("picocolors"));
const client_js_1 = __importDefault(require("../client.js"));
const constants_js_1 = require("../constants.js");
const package_json_1 = require("../../package.json");
const config_js_1 = require("../config.js");
const dotenv_1 = __importDefault(require("dotenv"));
console.log(picocolors_1.default.cyan(picocolors_1.default.bold(` 🤩 Testomat.io Reporter v${package_json_1.version}`)));
const program = new commander_1.Command();
program
    .option('-c, --command <cmd>', 'Test runner command')
    .option('--launch', 'Start a new run and return its ID')
    .option('--finish', 'Finish Run by its ID')
    .option('--env-file <envfile>', 'Load environment variables from env file')
    .option('--filter <filter>', 'Additional execution filter')
    .action(async (opts) => {
    const { launch, finish, filter } = opts;
    let { command } = opts;
    if (opts.envFile)
        dotenv_1.default.config({ path: opts.envFile });
    const apiKey = process.env['INPUT_TESTOMATIO-KEY'] || config_js_1.config.TESTOMATIO;
    const title = process.env.TESTOMATIO_TITLE;
    if (launch) {
        console.log('Starting a new Run on Testomat.io...');
        const client = new client_js_1.default({ apiKey });
        client.createRun().then(() => {
            console.log(process.env.runId);
            process.exit(0);
        });
        return;
    }
    if (finish) {
        // TODO: add error in case of TESTOMATIO environment variable is not set
        // because command is fine in console, but actually (on testomat.io) run is not finished
        if (!process.env.TESTOMATIO_RUN) {
            console.log('TESTOMATIO_RUN environment variable must be set.');
            return process.exit(1);
        }
        console.log('Finishing Run on Testomat.io...');
        const client = new client_js_1.default({ apiKey });
        // @ts-ignore
        client.updateRunStatus(constants_js_1.STATUS.FINISHED).then(() => {
            console.log(picocolors_1.default.yellow(`Run ${process.env.TESTOMATIO_RUN} was finished`));
            process.exit(0);
        });
        return;
    }
    let exitCode = 0;
    if (!command.split) {
        process.exitCode = 255;
        console.log(constants_js_1.APP_PREFIX, `No command provided. Use -c option to launch a test runner.`);
        return;
    }
    const client = new client_js_1.default({ apiKey, title, parallel: true });
    if (filter) {
        const [pipe, ...optsArray] = filter.split(':');
        const pipeOptions = optsArray.join(':');
        try {
            const tests = await client.prepareRun({ pipe, pipeOptions });
            if (!tests || tests.length === 0) {
                return;
            }
            const grep = ` --grep (${tests.join('|')})`;
            command += grep;
        }
        catch (err) {
            console.log(constants_js_1.APP_PREFIX, err);
        }
    }
    const testCmds = command.split(' ');
    console.log(constants_js_1.APP_PREFIX, `🚀 Running`, picocolors_1.default.green(command));
    if (!apiKey) {
        const cmd = (0, cross_spawn_1.spawn)(testCmds[0], testCmds.slice(1), { stdio: 'inherit' });
        cmd.on('close', code => {
            console.log(constants_js_1.APP_PREFIX, '⚠️ ', `Runner exited with ${picocolors_1.default.bold(code)}, report is ignored`);
            if (code > exitCode)
                exitCode = code;
            process.exitCode = exitCode;
        });
        return;
    }
    client.createRun().then(() => {
        const cmd = (0, cross_spawn_1.spawn)(testCmds[0], testCmds.slice(1), { stdio: 'inherit' });
        cmd.on('close', code => {
            const emoji = code === 0 ? '🟢' : '🔴';
            console.log(constants_js_1.APP_PREFIX, emoji, `Runner exited with ${picocolors_1.default.bold(code)}`);
            const status = code === 0 ? 'passed' : 'failed';
            client.updateRunStatus(status, true);
            if (code > exitCode)
                exitCode = code;
            process.exitCode = exitCode;
        });
    });
});
if (process.argv.length <= 2) {
    program.outputHelp();
}
program.parse(process.argv);
