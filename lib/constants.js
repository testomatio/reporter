import chalk from 'chalk';

export const APP_PREFIX = chalk.gray('[TESTOMATIO]');
export const TESTOMAT_ARTIFACT_SUFFIX = "testomatio_artifact_";

export const CSV_HEADERS = [
  { id: 'suite_title', title: 'Suite_title' },
  { id: 'title', title: 'Title' },
  { id: 'status', title: 'Status' },
  { id: 'message', title: 'Message' },
  { id: 'stack', title: 'Stack' },
];

export const STATUS = Object.freeze({
  PASSED: 'passed',
  FAILED: 'failed',
  SKIPPED: 'skipped',
  FINISHED: 'finished',
});
