#!/usr/bin/env node
const program = require('commander');
const chalk = require('chalk');
const debug = require('debug')('@testomatio/reporter:upload-cli');
const TestomatClient = require('../client');
const { APP_PREFIX } = require('../constants');
const { version } = require('../../package.json');
const config = require('../config');

console.log(chalk.cyan.bold(` 🤩 Testomat.io Reporter v${version}`));

program
  .option('--env-file <envfile>', 'Load environment variables from env file')
  .option('--force', 'Re-upload artifacts even if they were uploaded before')
  .action(async opts => {

    if (opts.envFile) {
      require('dotenv').config(opts.envFile); // eslint-disable-line
    } else {
      // try to load from env file
      require('dotenv').config(); // eslint-disable-line
    }

    const apiKey = config.TESTOMATIO;

    process.env.TESTOMATIO_DISABLE_ARTIFACTS = '';
    // process.env.TESTOMATIO_ARTIFACTS_SIZE = null;

    const client = new TestomatClient({
      apiKey,
      isBatchEnabled: false,
     });

    let testruns = client.uploader.readUploadedFiles(process.env.TESTOMATIO_RUN);

    const numTotalArtifacts = testruns.length;

    debug('Found testruns:', testruns);

    if (!opts.force) testruns = testruns.filter(tr => !tr.uploaded);

    if (!testruns.length) {
      console.log(APP_PREFIX, 'Total artifacts:', numTotalArtifacts);
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

    let numArtifacts = 0;

    // we need to obtain S3 credentials
    await client.createRun();

    client.uploader.checkEnabled();
    client.uploader.disbleLogStorage();

    for (const rid in testrunsByRid) {
      const files = testrunsByRid[rid];
      numArtifacts += files.length;
      await client.addTestRun(undefined, {
        rid,
        files,
      });
    }

  console.log(APP_PREFIX, client.uploader.totalUploaded, 'artifacts uploaded');
    if (client.uploader.failedUpload) {
      console.log(APP_PREFIX, client.uploader.failedUpload, 'artifacts failed to upload');
    }
  });

if (process.argv.length <= 1) {
  program.outputHelp();
}

program.parse(process.argv);
