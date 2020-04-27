const axios = require('axios').default;

const TESTOMAT_URL = process.env.TESTOMATIO_URL || 'https://app.testomat.io/api/load';

class TestomatClient {
  /**
   * Create a Testomat client instance
   *
   * @param {*} params
   */
  constructor(params) {
    this.apiKey = params.apiKey;
    this.runId = null;
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
      console.log('Run id already available');
      return Promise.resolve(runId);
    }
    this.queue = this.queue.then(() => axios.post(`${TESTOMAT_URL}/api/reporter`, { api_key: this.apiKey })
      .then(resp => {
        this.runId = resp.data.uid;
        process.env.runId = this.runId;
      }));

    return this.queue;
  }

  /**
   * Used to add a new test to Run instance
   *
   * @returns {Promise}
   */
  addTestRun(testId, status, message = '', title) {
    const testData = {};
    if (testId) {
      testData.test_id = testId;
    } else {
      testData.title = title;
    }
    this.queue = this.queue.then(() => axios.post(`${TESTOMAT_URL}/api/reporter/${this.runId}/testrun`, {
      api_key: this.apiKey,
      status,
      message,
      ...testData,
    }));

    return this.queue;
  }

  /**
   * Update run status
   *
   * @returns {Promise}
   */
  updateRunStatus(status) {
    this.queue = this.queue.then(() => axios.put(`${TESTOMAT_URL}/api/reporter/${this.runId}`, {
      api_key: this.apiKey,
      status,
    }));
    return this.queue;
  }
}


module.exports = TestomatClient;
