#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const picocolors_1 = __importDefault(require("picocolors"));
const debug_1 = __importDefault(require("debug"));
const client_js_1 = __importDefault(require("../client.js"));
const constants_js_1 = require("../constants.js");
const package_json_1 = require("../../package.json");
const config_js_1 = require("../config.js");
const utils_js_1 = require("../utils/utils.js");
const debug = (0, debug_1.default)('@testomatio/reporter:upload-cli');
console.log(picocolors_1.default.cyan(picocolors_1.default.bold(` 🤩 Testomat.io Reporter v${package_json_1.version}`)));
const program = new commander_1.Command();
program
    .option('--env-file <envfile>', 'Load environment variables from env file')
    .option('--force', 'Re-upload artifacts even if they were uploaded before')
    .action(async (opts) => {
    if (opts.envFile) {
        require('dotenv').config(opts.envFile); // eslint-disable-line
    }
    else {
        // try to load from env file
        require('dotenv').config(); // eslint-disable-line
    }
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
    let testruns = client.uploader.readUploadedFiles(process.env.TESTOMATIO_RUN);
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
    // we need to obtain S3 credentials
    await client.createRun();
    client.uploader.checkEnabled();
    client.uploader.disableLogStorage();
    for (const rid in testrunsByRid) {
        const files = testrunsByRid[rid];
        await client.addTestRun(undefined, {
            rid,
            files,
        });
    }
    console.log(constants_js_1.APP_PREFIX, client.uploader.successfulUploads.length, 'artifacts uploaded');
    if (client.uploader.failedUploads.length) {
        console.log(constants_js_1.APP_PREFIX, client.uploader.failedUploads.length, 'artifacts failed to upload');
    }
});
if (process.argv.length <= 1) {
    program.outputHelp();
}
program.parse(process.argv);
