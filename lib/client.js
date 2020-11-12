const axios = require('axios').default;
const { PASSED, FAILED } = require('./constants');

const TESTOMAT_URL = process.env.TESTOMATIO_URL || 'https://app.testomat.io';

class TestomatClient {
  /**
   * Create a Testomat client instance
   *
   * @param {*} params
   */
  constructor(params) {
    this.apiKey = params.apiKey;
    this.title = params.title || process.env.TESTOMATIO_TITLE
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
        api_key: this.apiKey.trim() ,
        title: this.title,
      })
      .then(resp => {
        this.runId = resp.data.uid;
        process.env.runId = this.runId;
      }))
      .catch(err => {
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
  addTestRun(testId, status, message = '', title, runTime) {
    const testData = {};
    if (testId) {
      testData.test_id = testId;
    } else {
      testData.title = title;
    }
    this.queue = this.queue.finally(() => {
      if (this.runId) {
        return axios.post(`${TESTOMAT_URL}/api/reporter/${this.runId}/testrun`, {
          api_key: this.apiKey,
          status,
          message,
          run_time: runTime,
          ...testData,
        });
      }
    }).catch(err => {
      console.log(`[Testomatio] Test ${testId}-${title} was not found in Testomat.io, skipping...`);
    });

    return this.queue;
  }

  /**
   * Update run status
   *
   * @returns {Promise}
   */
  updateRunStatus(status) {
    this.queue = this.queue.finally(() => {
      if (this.runId) {
        let status_event;
        if (status === PASSED) status_event = 'pass';
        if (status === FAILED) status_event = 'fail';
        return axios.put(`${TESTOMAT_URL}/api/reporter/${this.runId}`, { api_key: this.apiKey, status_event, status });
      }
    }).catch(err => {
      console.log(`[Testomatio] Error updating status, skipping...`, err);
    });
    return this.queue;
  }
}


module.exports = TestomatClient;
