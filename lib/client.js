const axios = require('axios').default;
const { PASSED, FAILED } = require('./constants');
const createCallsiteRecord = require('callsite-record');
const defaultRenderer = require('callsite-record').renderers.noColor;
const { sep } = require('path');
const chalk = require('chalk');
const { uploadFile } = require('./fileUploader');

const TESTOMAT_URL = process.env.TESTOMATIO_URL || 'https://app.testomat.io';
const { TESTOMATIO_RUNGROUP_TITLE } = process.env;
const { TESTOMATIO_ENV } = process.env;

class TestomatClient {
  /**
   * Create a Testomat client instance
   *
   * @param {*} params
   */
  constructor(params) {
    this.apiKey = params.apiKey;
    this.title = params.title || process.env.TESTOMATIO_TITLE;
    this.runId = process.env.runId;
    this.queue = Promise.resolve();
  }

  /**
   * Used to create a new Test run
   *
   * @returns {Promise} - resolves to Run id which should be used to update / add test
   */
  createRun() {
    const { runId } = process.env;
    if (runId) {
      this.runId = runId;
      return Promise.resolve(runId);
    }
    this.queue = this.queue.then(() => axios.post(`${TESTOMAT_URL.trim()}/api/reporter`, {
      api_key: this.apiKey.trim(),
      title: this.title,
      group_title: TESTOMATIO_RUNGROUP_TITLE,
      env: TESTOMATIO_ENV,
    })
      .then(resp => {
        this.runId = resp.data.uid;
        console.log('📊 Testomatio Reporter Started. Run ID:', this.runId);
        process.env.runId = this.runId;
      }))
      .catch(() => {
        console.log('[Testomatio] Error creating a test run on testomat.io, please check if your API key is valid');
        process.exit(1);
      });

    return this.queue;
  }

  /**
   * Used to add a new test to Run instance
   *
   * @returns {Promise}
   */
  async addTestRun(testId, status, testData = {}) {
    let {
      message = '',
      error = '',
      title = '',
      time = '',
      example = null,
      files = [],
      steps,
    } = testData;
    const uploadedFiles = [];

    if (testId) {
      testData.test_id = testId;
    }

    let stack = null;

    if (error) {
      try {
        const record = createCallsiteRecord({ forError: error });
        if (record) {
          stack = record.renderSync({
            stackFilter: frame => frame.getFileName().indexOf(sep) > -1 && frame.getFileName().indexOf('node_modules') < 0,
          });
        }
      } catch (e) {
        console.log(e);
      }

      if (!message) message = error.message;
    }

    if (steps) {
      stack = stack ? `${steps}\n\n${chalk.bold.red('################[ Failure ]################')}\n${stack}` : steps;
    }

    if (!this.runId) {
      console.log('No current Testomatio run, skipping report');
    } else {
      for (const file of files) {
        uploadedFiles.push(uploadFile(file, this.runId));
      }
    }

    this.queue = this.queue.then(async () => {
      if (this.runId) {
        return axios.post(`${TESTOMAT_URL}/api/reporter/${this.runId}/testrun`, {
          api_key: this.apiKey,
          ...testData,
          status,
          stack,
          example,
          message,
          run_time: time,
          artifacts: await Promise.all(uploadedFiles),
        });
      }
    }).catch(err => {
      console.log(`[Testomatio] Report couldn't be processed: ${err.response.data.message}`);
    });

    return this.queue;
  }

  /**
   * Update run status
   *
   * @returns {Promise}
   */
  updateRunStatus(status) {
    this.queue = this.queue.then(() => {
      if (this.runId) {
        let status_event;
        if (status === PASSED) status_event = 'pass';
        if (status === FAILED) status_event = 'fail';
        return axios.put(`${TESTOMAT_URL}/api/reporter/${this.runId}`, { api_key: this.apiKey, status_event, status });
      }
    }).catch(err => {
      console.log('[Testomatio] Error updating status, skipping...', err);
    });
    return this.queue;
  }
}

module.exports = TestomatClient;
