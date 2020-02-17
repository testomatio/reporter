const axios = require('axios').default;

const TESTOMAT_URL = 'http://localhost:3000'; // Should be changed to ENV variable

class TestomatClient {
  /**
   * Create a Testomat client instance
   *
   * @param {*} params
   */
  constructor(params) {
    this.apiKey = params.apiKey;
    this.runId = null;
  }

  /**
   * Used to create a new Test run
   *
   * @returns {Promise} - resolves to Run id which should be used to update / add test
   */
  createRun() {
    return new Promise((resolve, reject) => {
      axios.post(`${TESTOMAT_URL}/api/reporter`, { api_key: this.apiKey })
        .then(resp => {
          this.runId = resp.data.uid;
          resolve(this.runId);
        })
        .catch(err => reject(err));
    });
  }

  /**
   * Used to add a new test to Run instance
   *
   * @returns {Promise}
   */
  addTestRun(testId, status, message = '') {
    return axios.post(`${TESTOMAT_URL}/api/reporter/${this.runId}/testrun`, {
      api_key: this.apiKey,
      status,
      message,
      test_id: testId,
    });
  }

  updateRunStatus(status) {
    return axios.put(`${TESTOMAT_URL}/api/reporter/${this.runId}`, {
      api_key: this.apiKey,
      status,
    });
  }
}

module.exports = TestomatClient;
