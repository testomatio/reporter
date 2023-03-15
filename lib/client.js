const axios = require('axios');
const JsonCycle = require('json-cycle');
const createCallsiteRecord = require('callsite-record');
const { sep, join } = require('path');
const fs = require('fs');
const chalk = require('chalk');
const upload = require('./fileUploader');
const { isValidUrl } = require('./util');
const { PASSED, FAILED, FINISHED, APP_PREFIX } = require('./constants');

const TESTOMAT_URL = process.env.TESTOMATIO_URL || 'https://app.testomat.io';
const { TESTOMATIO_RUNGROUP_TITLE, TESTOMATIO_ENV, TESTOMATIO_RUN } = process.env;

if (TESTOMATIO_RUN) {
  process.env.runId = TESTOMATIO_RUN;
}

class TestomatClient {
  /**
   * Create a Testomat client instance
   *
   * @param {*} params
   */
  constructor(params) {
    this.apiKey = params.apiKey || process.env.TESTOMATIO;
    this.title = params.title || process.env.TESTOMATIO_TITLE;
    this.createNewTests = params.createNewTests ?? !!process.env.TESTOMATIO_CREATE;
    this.proceed = process.env.TESTOMATIO_PROCEED;
    this.env = TESTOMATIO_ENV;
    this.parallel = params.parallel;
    this.runId = process.env.runId;
    this.queue = Promise.resolve();
    this.axios = axios.create();
    this.totalUploaded = 0;
    this.version = JSON.parse(fs.readFileSync(join(__dirname, '..', 'package.json')).toString()).version;
  }

  /**
   * Used to create a new Test run
   *
   * @returns {Promise} - resolves to Run id which should be used to update / add test
   */
  createRun() {
    const { runId } = process.env;
    if (!this.apiKey) throw new Error("No API key is set, can't create run");
    const runParams = {
      api_key: this.apiKey.trim(),
      title: this.title,
      parallel: this.parallel,
      env: this.env,
      group_title: TESTOMATIO_RUNGROUP_TITLE,
    };

    global.testomatioArtifacts = [];

    if (!isValidUrl(TESTOMAT_URL.trim())) {
      console.log(
        APP_PREFIX,
        chalk.red(`Error creating report on Testomat.io, report url '${TESTOMAT_URL}' is invalid`),
      );
      return;
    }

    if (runId) {
      this.runId = runId;
      this.queue = this.queue.then(() => axios.put(`${TESTOMAT_URL.trim()}/api/reporter/${runId}`, runParams));
      return Promise.resolve(runId);
    }

    this.queue = this.queue
      .then(() =>
        this.axios.post(`${TESTOMAT_URL.trim()}/api/reporter`, runParams).then(resp => {
          this.runId = resp.data.uid;
          this.runUrl = `${TESTOMAT_URL}/${resp.data.url.split('/').splice(3).join('/')}`;
          console.log(APP_PREFIX, '📊 Report created. Report ID:', this.runId, chalk.gray(`v${this.version}`));
          process.env.runId = this.runId;
        }),
      )
      .catch(() => {
        console.log(
          APP_PREFIX,
          'Error creating report Testomat.io, please check if your API key is valid. Skipping report',
        );
      });

    return this.queue;
  }

  /**
   * Used to add a new test to Run instance
   *
   * @returns {Promise}
   */
  async addTestRun(testId, status, testData = {}) {
    const {
      error = '',
      time = '',
      example = null,
      files = [],
      filesBuffers = [],
      steps,
      title,
      suite_title,
      suite_id,
      test_id,
    } = testData;
    let { message = '' } = testData;

    const uploadedFiles = [];

    if (testId) testData.test_id = testId;

    let stack = '';

    if (error) {
      stack = this.formatError(error);
      message = error.message;
    }
    if (steps) {
      stack = this.formatSteps(stack, steps);
    }

    if (this.runId) {
      if (Array.isArray(global.testomatioArtifacts)) {
        files.push(...global.testomatioArtifacts);
        global.testomatioArtifacts = [];
      }

      for (const file of files) {
        uploadedFiles.push(upload.uploadFileByPath(file, this.runId));
      }

      for (const [idx, buffer] of filesBuffers.entries()) {
        const fileName = `${idx + 1}-${title.replace(/\s+/g, '-')}`;

        uploadedFiles.push(upload.uploadFileAsBuffer(buffer, fileName, this.runId));
      }
    }

    this.queue = this.queue
      .then(async () => {
        if (!this.runId) return;

        global.testomatioArtifacts = [];

        this.totalUploaded += uploadedFiles.filter(n => n).length;

        const json = JsonCycle.stringify({
          api_key: this.apiKey,
          create: this.createNewTests,
          files,
          steps,
          status,
          stack,
          example,
          title,
          suite_title,
          suite_id,
          test_id,
          message,
          run_time: time,
          artifacts: await Promise.all(uploadedFiles),
        });
        return this.axios.post(`${TESTOMAT_URL}/api/reporter/${this.runId}/testrun`, json, {
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          headers: {
            // Overwrite Axios's automatically set Content-Type
            'Content-Type': 'application/json',
          },
        });
      })
      .catch(err => {
        if (err.response) {
          if (err.response.status >= 400) {
            const data = err.response.data || { message: '' };
            console.log(
              APP_PREFIX,
              chalk.blue(title),
              `Report couldn't be processed: (${err.response.status}) ${data.message}`,
            );
            return;
          }
          console.log(APP_PREFIX, chalk.blue(title), `Report couldn't be processed: ${err.response.data.message}`);
        } else {
          console.log(APP_PREFIX, chalk.blue(title), "Report couldn't be processed", err);
        }
      });

    return this.queue;
  }

  /**
   * Update run status
   *
   * @returns {Promise}
   */
  updateRunStatus(status, isParallel) {
    this.queue = this.queue
      .then(async () => {
        if (this.runId && !this.proceed) {
          let statusEvent;
          if (status === FINISHED) statusEvent = 'finish';
          if (status === PASSED) statusEvent = 'pass';
          if (status === FAILED) statusEvent = 'fail';
          if (isParallel) statusEvent += '_parallel';
          await this.axios.put(`${TESTOMAT_URL}/api/reporter/${this.runId}`, {
            api_key: this.apiKey,
            status_event: statusEvent,
            status,
          });
          if (this.runUrl) {
            console.log(APP_PREFIX, '📊 Report Saved. Report URL:', chalk.magenta(this.runUrl));
          }

          if (upload.isArtifactsEnabled && this.totalUploaded > 0) {
            console.log(
              APP_PREFIX,
              `🗄️  Total ${this.totalUploaded} artifacts ${
                process.env.TESTOMATIO_PRIVATE_ARTIFACTS ? 'privately' : chalk.bold('publicly')
              } uploaded to S3 bucket  `,
            );
          }
        }
        if (this.runUrl && this.proceed) {
          const notFinishedMessage = chalk.yellow.bold('Run was not finished because of $TESTOMATIO_PROCEED');
          console.log(APP_PREFIX, `📊 ${notFinishedMessage}. Report URL: ${chalk.magenta(this.runUrl)}`);
          console.log(APP_PREFIX, `🛬 Run to finish it: TESTOMATIO_RUN=${this.runId} npx start-test-run --finish`);
        }
      })
      .catch(err => {
        console.log(APP_PREFIX, 'Error updating status, skipping...', err);
      });
    return this.queue;
  }

  formatSteps(stack, steps) {
    return stack ? `${steps}\n\n${chalk.bold.red('################[ Failure ]################')}\n${stack}` : steps;
  }

  formatError(error, message) {
    if (!message) message = error.message;
    if (error.inspect) message = error.inspect() || '';

    let stack = `\n${chalk.bold(message)}\n`;

    // diffs for mocha, cypress, codeceptjs style
    if (error.actual && error.expected) {
      stack += `\n\n${chalk.bold.green('+ expected')} ${chalk.bold.red('- actual')}`;
      stack += `\n${chalk.red(`- ${error.actual.toString().split('\n').join('\n- ')}`)}`;
      stack += `\n${chalk.green(`+ ${error.expected.toString().split('\n').join('\n+ ')}`)}`;
      stack += '\n\n';
    }

    try {
      const record = createCallsiteRecord({
        forError: error,
      });
      if (record && !record.filename.startsWith('http')) {
        stack += record.renderSync({
          stackFilter: frame =>
            frame.getFileName().indexOf(sep) > -1 &&
            frame.getFileName().indexOf('node_modules') < 0 &&
            frame.getFileName().indexOf('internal') < 0,
        });
      }
      return stack;
    } catch (e) {
      console.log(e);
    }
  }
}

module.exports = TestomatClient;
