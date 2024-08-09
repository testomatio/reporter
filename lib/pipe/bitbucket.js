const debug = require('debug')('@testomatio/reporter:pipe:bitbucket');
const { default: axios } = require('axios');
const chalk = require('chalk');
const humanizeDuration = require('humanize-duration');
const merge = require('lodash.merge');
const path = require('path');
const { APP_PREFIX, testomatLogoURL } = require('../constants');
const { ansiRegExp, isSameTest } = require('../utils/utils');
const { statusEmoji, fullName } = require('../utils/pipe_utils');

//! BITBUCKET_PAT environment variable is required for this functionality to work
//! and your pipeline trigger should be a pull request

/**
 * @class BitbucketPipe
 * @typedef {import('../../types').Pipe} Pipe
 * @typedef {import('../../types').TestData} TestData
 */
class BitbucketPipe {
  constructor(params, store = {}) {
    this.isEnabled = false;
    this.ENV = process.env;
    this.store = store;
    this.tests = [];
    // Bitbucket PAT looks like bbpat-*****
    this.token = params.BITBUCKET_PAT || process.env.BITBUCKET_PAT || this.ENV.BITBUCKET_PAT;
    this.hiddenCommentData = `<!--- testomat.io report ${process.env.BITBUCKET_STEP_NAME || ''} -->`;

    debug(
      chalk.yellow('Bitbucket Pipe:'),
      this.token ? 'TOKEN passed' : '*no token*',
      `Project key: ${this.ENV.BITBUCKET_PROJECT_KEY}, Pull request ID: ${this.ENV.BITBUCKET_PR_ID}`,
    );

    if (!this.ENV.BITBUCKET_PROJECT_KEY || !this.ENV.BITBUCKET_PR_ID) {
      debug(`CI pipeline should be run in a Pull Request to have the ability to add the report comment.`);
      return;
    }

    if (!this.token) {
      debug(`Hint: Bitbucket CI variables are unavailable for unprotected branches by default.`);
      return;
    }

    this.isEnabled = true;

    debug('Bitbucket Pipe: Enabled');
  }

  // Prepare the run (if needed)
  async prepareRun() {}

  // Create a new run (if needed)
  async createRun() {}

  addTest(test) {
    if (!this.isEnabled) return;

    const index = this.tests.findIndex(t => isSameTest(t, test));
    // Update if they were already added
    if (index >= 0) {
      this.tests[index] = merge(this.tests[index], test);
      return;
    }

    this.tests.push(test);
  }

  async finishRun(runParams) {
    if (!this.isEnabled) return;

    if (runParams.tests) runParams.tests.forEach(t => this.addTest(t));

    // Create a comment on Bitbucket
    const passedCount = this.tests.filter(t => t.status === 'passed').length;
    const failedCount = this.tests.filter(t => t.status === 'failed').length;
    const skippedCount = this.tests.filter(t => t.status === 'skipped').length;

    // Constructing the table
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

    if (this.ENV.BITBUCKET_STEP_NAME && this.ENV.BITBUCKET_STEP_UUID) {
      // eslint-disable-next-line max-len
      summary += `| Job | 👷 [${this.ENV.BITBUCKET_STEP_UUID}](${this.ENV.BITBUCKET_PIPELINE_STEP_URL})<br>Name: **${this.ENV.BITBUCKET_STEP_NAME}** | `;
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
      body += `\n<details>\n<summary><h3>🟥 Failures (${failures.length})</h3></summary>\n\n${failures.join('\n')}\n`;
      if (failures.length > 20) {
        body += '\n> Notice\n> Only first 20 failures shown*';
      }
      body += '\n\n</details>';
    }

    if (this.tests.length > 0) {
      body += '\n<details>\n<summary><h3>🐢 Slowest Tests</h3></summary>\n\n';
      body += this.tests
        .sort((a, b) => b.run_time - a.run_time)
        .slice(0, 5)
        .map(t => `* ${fullName(t)} (${humanizeDuration(parseFloat(t.run_time))})`)
        .join('\n');
      body += '\n</details>';
    }

    // Construct Bitbucket API URL for comments
    // eslint-disable-next-line max-len
    const commentsRequestURL = `https://api.bitbucket.org/2.0/repositories/${this.ENV.BITBUCKET_WORKSPACE}/${this.ENV.BITBUCKET_REPO_SLUG}/pullrequests/${this.ENV.BITBUCKET_PR_ID}/comments`;

    // Delete previous report
    await deletePreviousReport(axios, commentsRequestURL, this.hiddenCommentData, this.token);

    // Add current report
    debug(`Adding comment via URL: ${commentsRequestURL}`);

    try {
      const addCommentResponse = await axios.post(
        commentsRequestURL,
        { content: { raw: body } },
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const commentID = addCommentResponse.data.id;
      // eslint-disable-next-line max-len
      const commentURL = `${this.ENV.BITBUCKET_REPO_URL}/pull-requests/${this.ENV.BITBUCKET_PR_ID}#comment-${commentID}`;

      console.log(APP_PREFIX, chalk.yellow('Bitbucket'), `Report created: ${chalk.magenta(commentURL)}`);
    } catch (err) {
      console.error(
        APP_PREFIX,
        chalk.yellow('Bitbucket'),
        `Couldn't create Bitbucket report\n${err}.
      Request URL: ${commentsRequestURL}
      Request data: ${body}`,
      );
    }
  }

  toString() {
    return 'Bitbucket Reporter';
  }

  updateRun() {}
}

async function deletePreviousReport(axiosInstance, commentsRequestURL, hiddenCommentData, token) {
  if (process.env.BITBUCKET_KEEP_OUTDATED_REPORTS) return;

  // Get comments
  let comments = [];

  try {
    const response = await axiosInstance.get(commentsRequestURL, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    comments = response.data.values;
  } catch (e) {
    console.error('Error while attempting to retrieve comments on Bitbucket Pull Request:\n', e);
  }

  if (!comments.length) return;

  for (const comment of comments) {
    // If comment was left by the same workflow
    if (comment.content.raw.includes(hiddenCommentData)) {
      try {
        // Delete previous comment
        const deleteCommentURL = `${commentsRequestURL}/${comment.id}`;
        await axiosInstance.delete(deleteCommentURL, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
      } catch (e) {
        console.warn(`Can't delete previously added comment with testomat.io report. Ignored.`);
      }

      // Pass next env var if need to clear all previous reports;
      // only the last one is removed by default
      if (!process.env.BITBUCKET_REMOVE_ALL_OUTDATED_REPORTS) break;
      // TODO: in case of many reports should implement pagination
    }
  }
}

module.exports = BitbucketPipe;
