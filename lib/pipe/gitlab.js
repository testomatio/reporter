const debug = require('debug')('@testomatio/reporter:pipe:gitlab');
const { default: axios } = require('axios');
const chalk = require('chalk');
const humanizeDuration = require('humanize-duration');
const merge = require('lodash.merge');
const path = require('path');
const { APP_PREFIX, testomatLogoURL } = require('../constants');
const { ansiRegExp, isSameTest } = require('../utils/utils');
const { statusEmoji, fullName } = require('../utils/pipe_utils');

//! GITLAB_PAT environment variable is required for this functionality to work
//! and your pipeline trigger should be merge_request

/**
 * @class GitLabPipe
 * @typedef {import('../../types').Pipe} Pipe
 * @typedef {import('../../types').TestData} TestData
 */
class GitLabPipe {
  constructor(params, store = {}) {
    this.isEnabled = false;
    this.ENV = process.env;
    this.store = store;
    this.tests = [];
    // GitLab PAT looks like glpat-nKGdja3jsG4850sGksh7
    this.token = params.GITLAB_PAT || process.env.GITLAB_PAT || this.ENV.GITLAB_PAT;
    this.hiddenCommentData = `<!--- testomat.io report ${process.env.CI_JOB_NAME || ''} -->`;

    debug(
      chalk.yellow('GitLab Pipe:'),
      this.token ? 'TOKEN passed' : '*no token*',
      `Project id: ${this.ENV.CI_PROJECT_ID}, MR id: ${this.ENV.CI_MERGE_REQUEST_IID}`,
    );

    if (!this.ENV.CI_PROJECT_ID || !this.ENV.CI_MERGE_REQUEST_IID) {
      debug(`CI pipeline should be run in Merge Request to have ability to add the report comment.`);
      return;
    }

    if (!this.token) {
      debug(`Hint: GitLab CI variables are unavailable for unprotected branches by default.`);
      return;
    }

    this.isEnabled = true;

    debug('GitLab Pipe: Enabled');
  }

  // TODO: to using SET opts as argument => prepareRun(opts)
  async prepareRun() {}

  async createRun() {}

  addTest(test) {
    if (!this.isEnabled) return;

    const index = this.tests.findIndex(t => isSameTest(t, test));
    // update if they were already added
    if (index >= 0) {
      this.tests[index] = merge(this.tests[index], test);
      return;
    }

    this.tests.push(test);
  }

  async finishRun(runParams) {
    if (!this.isEnabled) return;

    if (runParams.tests) runParams.tests.forEach(t => this.addTest(t));

    // ... create a comment on GitLab
    const passedCount = this.tests.filter(t => t.status === 'passed').length;
    const failedCount = this.tests.filter(t => t.status === 'failed').length;
    const skippedCount = this.tests.filter(t => t.status === 'skipped').length;

    // constructing the table
    let summary = `${this.hiddenCommentData}
    
  | [![Testomat.io Report](${testomatLogoURL})](https://testomat.io)  | ${statusEmoji(
    runParams.status,
  )} ${runParams.status.toUpperCase()} ${statusEmoji(runParams.status)} |
  | --- | --- |
  | Tests | ✔️  **${this.tests.length}** tests run  |
  | Summary | ${statusEmoji('failed')} **${failedCount}** failed; ${statusEmoji(
    'passed',
  )} **${passedCount}** passed; **${statusEmoji('skipped')}** ${skippedCount} skipped |
  | Duration | 🕐  **${humanizeDuration(
    parseInt(
      this.tests.reduce((a, t) => a + (t.run_time || 0), 0),
      10,
    ),
    {
      maxDecimalPoints: 0,
    },
  )}** |
  `;

    if (this.ENV.CI_JOB_NAME && this.ENV.CI_JOB_ID) {
      // eslint-disable-next-line max-len
      summary += `| Job | 👷 [${this.ENV.CI_JOB_ID}](${this.ENV.CI_JOB_URL})<br>Name: **${this.ENV.CI_JOB_NAME}**<br>Stage: **${this.ENV.CI_JOB_STAGE}** | `;
    }

    const failures = this.tests
      .filter(t => t.status === 'failed')
      .slice(0, 20)
      .map(t => {
        let text = `#### ${statusEmoji('failed')} ${fullName(t)} `;
        text += '\n\n';
        if (t.message)
          text += `> ${t.message
            .replace(/[^\x20-\x7E]/g, '')
            .replace(ansiRegExp(), '')
            .trim()}\n`;
        if (t.stack) text += `\`\`\`diff\n${t.stack.replace(ansiRegExp(), '').trim()}\n\`\`\`\n`;

        if (t.artifacts && t.artifacts.length && !this.ENV.TESTOMATIO_PRIVATE_ARTIFACTS) {
          t.artifacts
            .filter(f => !!f)
            .filter(f => f.endsWith('.png'))
            .forEach(f => {
              if (f.endsWith('.png')) {
                text += `![](${f})\n`;
                return text;
              }
              text += `[📄 ${path.basename(f)}](${f})\n`;
              return text;
            });
        }

        text += '\n---\n';

        return text;
      });

    let body = summary;

    if (failures.length) {
      body += `\n<details>\n<summary><h3>🟥 Failures (${failures.length})</h4></summary>\n\n${failures.join('\n')}\n`;
      if (failures.length > 20) {
        body += '\n> Notice\n> Only first 20 failures shown*';
      }
      body += '\n\n</details>';
    }

    if (this.tests.length > 0) {
      body += '\n<details>\n<summary><h3>🐢 Slowest Tests</h3></summary>\n\n';
      body += this.tests
        // eslint-disable-next-line no-unsafe-optional-chaining
        .sort((a, b) => b?.run_time - a?.run_time)
        .slice(0, 5)
        .map(t => `* ${fullName(t)} (${humanizeDuration(parseFloat(t.run_time))})`)
        .join('\n');
      body += '\n</details>';
    }

    // eslint-disable-next-line max-len
    const commentsRequestURL = `https://gitlab.com/api/v4/projects/${this.ENV.CI_PROJECT_ID}/merge_requests/${this.ENV.CI_MERGE_REQUEST_IID}/notes`;

    // delete previous report
    await deletePreviousReport(axios, commentsRequestURL, this.hiddenCommentData, this.token);

    // add current report
    debug(`Adding comment via url: ${commentsRequestURL}`);

    try {
      const addCommentResponse = await axios.post(`${commentsRequestURL}?access_token=${this.token}`, { body });

      const commentID = addCommentResponse.data.id;
      // eslint-disable-next-line max-len
      const commentURL = `${this.ENV.CI_PROJECT_URL}/-/merge_requests/${this.ENV.CI_MERGE_REQUEST_IID}#note_${commentID}`;

      console.log(APP_PREFIX, chalk.yellow('GitLab'), `Report created: ${chalk.magenta(commentURL)}`);
    } catch (err) {
      console.error(
        APP_PREFIX,
        chalk.yellow('GitLab'),
        `Couldn't create GitLab report\n${err}.
      Request url: ${commentsRequestURL}
      Request data: ${body}`,
      );
    }
  }

  toString() {
    return 'GitLab Reporter';
  }

  updateRun() {}
}

async function deletePreviousReport(axiosInstance, commentsRequestURL, hiddenCommentData, token) {
  if (process.env.GITLAB_KEEP_OUTDATED_REPORTS) return;

  // get comments
  let comments = [];

  try {
    const response = await axiosInstance.get(`${commentsRequestURL}?access_token=${token}`);
    comments = response.data;
  } catch (e) {
    console.error('Error while attempt to retrieve comments on GitLab Merge Request:\n', e);
  }

  if (!comments.length) return;

  for (const comment of comments) {
    // if comment was left by the same workflow
    if (comment.body.includes(hiddenCommentData)) {
      try {
        // delete previous comment
        const deleteCommentURL = `${commentsRequestURL}/${comment.id}?access_token=${token}`;
        await axiosInstance.delete(deleteCommentURL);
      } catch (e) {
        console.warn(`Can't delete previously added comment with testomat.io report. Ignore.`);
      }

      // pass next env var if need to clear all previous reports;
      // only the last one is removed by default
      if (!process.env.GITLAB_REMOVE_ALL_OUTDATED_REPORTS) break;
      // TODO: in case of many reports should implement pagination
    }
  }
}

module.exports = GitLabPipe;
