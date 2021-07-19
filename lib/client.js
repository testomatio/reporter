const axios = require("axios").default;
const JsonCycle = require("json-cycle");
const createCallsiteRecord = require("callsite-record");
const defaultRenderer = require("callsite-record").renderers.noColor;
const { sep } = require("path");
const chalk = require("chalk");
const { uploadFile } = require("./fileUploader");
const { PASSED, FAILED, APP_PREFIX } = require("./constants");

const TESTOMAT_URL = process.env.TESTOMATIO_URL || "https://app.testomat.io";
const { TESTOMATIO_RUNGROUP_TITLE } = process.env;
const { TESTOMATIO_ENV } = process.env;
const { TESTOMATIO_RUN } = process.env;

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
    this.parallel = params.parallel;
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
    const runParams = {
      api_key: this.apiKey.trim(),
      title: this.title,
      parallel: this.parallel,
      group_title: TESTOMATIO_RUNGROUP_TITLE,
      env: TESTOMATIO_ENV,
    };
    if (runId) {
      this.runId = runId;
      this.queue = this.queue.then(() =>
        axios.put(`${TESTOMAT_URL.trim()}/api/reporter/${runId}`, runParams)
      );
      return Promise.resolve(runId);
    }

    this.queue = this.queue
      .then(() =>
        axios
          .post(`${TESTOMAT_URL.trim()}/api/reporter`, runParams)
          .then((resp) => {
            this.runId = resp.data.uid;
            this.runUrl = resp.data.url;
            console.log(
              APP_PREFIX,
              "📊 Report created. Report ID:",
              this.runId
            );
            process.env.runId = this.runId;
          })
      )
      .catch(() => {
        console.log(
          APP_PREFIX,
          "Error creating a test run on testomat.io, please check if your API key is valid. Skipping report"
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
    let {
      message = "",
      error = "",
      title = "",
      time = "",
      example = null,
      files = [],
      steps,
    } = testData;

    const uploadedFiles = [];

    if (testId) testData.test_id = testId;

    let stack = "";

    if (error) {
      if (!message) message = error.message;
      if (error.inspect) message = error.inspect();

      stack = `\n${chalk.bold(message)}\n`;

      // diffs for mocha, cypress, codeceptjs style
      if (error.actual && error.expected) {
        stack += `\n\n${chalk.bold.green("+ expected")} ${chalk.bold.red(
          "- actual"
        )}`;
        stack += `\n${chalk.red(
          `- ${error.actual.toString().split("\n").join("\n- ")}`
        )}`;
        stack += `\n${chalk.green(
          `+ ${error.expected.toString().split("\n").join("\n+ ")}`
        )}`;
        stack += "\n\n";
      }

      try {
        const record = createCallsiteRecord({
          forError: error,
        });
        if (record) {
          stack += record.renderSync({
            stackFilter: (frame) =>
              frame.getFileName().indexOf(sep) > -1 &&
              frame.getFileName().indexOf("node_modules") < 0 &&
              frame.getFileName().indexOf("internal") < 0,
          });
        }
      } catch (e) {
        console.log(e);
      }
    }
    if (steps) {
      stack = stack
        ? `${steps}\n\n${chalk.bold.red(
            "################[ Failure ]################"
          )}\n${stack}`
        : steps;
    }

    if (this.runId) {
      for (const file of files) {
        uploadedFiles.push(uploadFile(file, this.runId));
      }
    }

    this.queue = this.queue
      .then(async () => {
        if (this.runId) {
          const json = JsonCycle.stringify({
            api_key: this.apiKey,
            ...testData,
            status,
            stack,
            example,
            message,
            run_time: time,
            artifacts: await Promise.all(uploadedFiles),
          });
          return axios.post(
            `${TESTOMAT_URL}/api/reporter/${this.runId}/testrun`,
            json,
            {
              headers: {
                // Overwrite Axios's automatically set Content-Type
                "Content-Type": "application/json",
              },
            },
          );
        }
      })
      .catch((err) => {
        if (err.response) {
          if (err.response.status >= 400) {
            console.log(
              APP_PREFIX,
              `Report couldn't be processed: ${err.response.status} ${error.response.data}`
            );
            return this.queue;
          }
          console.log(
            APP_PREFIX,
            `Report couldn't be processed: ${err.response.data.message}`
          );
        } else {
          console.log(APP_PREFIX, "Report couldn't be processed", err);
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
        if (this.runId) {
          let status_event;
          if (status === PASSED) status_event = "pass";
          if (status === FAILED) status_event = "fail";
          if (isParallel) status_event += "_parallel";
          await axios.put(`${TESTOMAT_URL}/api/reporter/${this.runId}`, {
            api_key: this.apiKey,
            status_event,
            status,
          });
          if (this.runUrl) {
            console.log(
              APP_PREFIX,
              "📊 Report Saved. Report URL:",
              chalk.magenta(this.runUrl)
            );
          }
        }
      })
      .catch((err) => {
        console.log(APP_PREFIX, "Error updating status, skipping...", err);
      });
    return this.queue;
  }
}

module.exports = TestomatClient;
