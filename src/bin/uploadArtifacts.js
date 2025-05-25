#!/usr/bin/env node

import { Command } from 'commander';
import pc from 'picocolors';
import createDebugMessages from 'debug';
import TestomatClient from '../client.js';
import { APP_PREFIX } from '../constants.js';
import { getPackageVersion } from '../utils/utils.js';
import { config } from '../config.js';
import { readLatestRunId } from '../utils/utils.js';
import dotenv from 'dotenv';

const debug = createDebugMessages('@testomatio/reporter:upload-cli');
const version = getPackageVersion();
console.log(pc.cyan(pc.bold(` 🤩 Testomat.io Reporter v${version}`)));
const program = new Command();

program
  .option('--env-file <envfile>', 'Load environment variables from env file')
  .option('--force', 'Re-upload artifacts even if they were uploaded before')
  .action(async opts => {
    if (opts.envFile) {
      dotenv.config({ path: opts.envFile });
    } else {
      dotenv.config();
    }

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

    console.log(APP_PREFIX, client.uploader.successfulUploads.length, 'artifacts uploaded');
    if (client.uploader.failedUploads.length) {
      console.log(APP_PREFIX, client.uploader.failedUploads.length, 'artifacts failed to upload');
    }
  });

if (process.argv.length <= 1) {
  program.outputHelp();
}

program.parse(process.argv);
