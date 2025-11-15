import { APP_PREFIX, testomatLogoURL } from '../constants.js';
import { ansiRegExp, isSameTest } from '../utils/utils.js';
import { statusEmoji, fullName } from '../utils/pipe_utils.js';
import { Gaxios } from 'gaxios';
import pc from 'picocolors';
import humanizeDuration from 'humanize-duration';
import merge from 'lodash.merge';
import path from 'path';
import createDebugMessages from 'debug';

const debug = createDebugMessages('@testomatio/reporter:pipe:bitbucket');

//! BITBUCKET_ACCESS_TOKEN environment variable is required for this functionality to work
//! and your pipeline trigger should be a pull request

/**
 * @class BitbucketPipe
 * @typedef {import('../../types/types.js').Pipe} Pipe
 * @typedef {import('../../types/types.js').TestData} TestData
 */
export class BitbucketPipe {
  constructor(params, store = {}) {
    this.isEnabled = false;
    this.ENV = process.env;
    this.store = store;
    this.tests = [];
    // Bitbucket PAT looks like bbpat-*****
    this.token = params.BITBUCKET_ACCESS_TOKEN || process.env.BITBUCKET_ACCESS_TOKEN || this.ENV.BITBUCKET_ACCESS_TOKEN;
    this.hiddenCommentData = `Testomat.io report: ${process.env.BITBUCKET_BRANCH || ''}`;

    debug(
      pc.yellow('Bitbucket Pipe:'),
      this.token ? 'TOKEN passed' : '*no token*',
      `Project key: ${this.ENV.BITBUCKET_PROJECT_KEY}, Pull request ID: ${this.ENV.BITBUCKET_PR_ID}`,
    );

    if (!this.token) {
      debug(`Hint: Bitbucket CI variables are unavailable for unprotected branches by default.`);
      return;
    }

    this.isEnabled = true;
    this.client = new Gaxios({
      baseURL: 'https://api.bitbucket.org/2.0',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
    });

    debug('Bitbucket Pipe: Enabled');
  }

  async cleanLog(log) {
    const stripAnsi = (await import('strip-ansi')).default;
    return stripAnsi(log);
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

    // Clean up the logs from ANSI codes
    for (let i = 0; i < this.tests.length; i++) {
      this.tests[i].message = await this.cleanLog(this.tests[i].message || '');
      this.tests[i].stack = await this.cleanLog(this.tests[i].stack || '');
    }

    // Create a comment on Bitbucket
    const passedCount = this.tests.filter(t => t.status === 'passed').length;
    const failedCount = this.tests.filter(t => t.status === 'failed').length;
    const skippedCount = this.tests.filter(t => t.status === 'skipped').length;

    // Constructing the table
    let summary = `${this.hiddenCommentData}
    
  | ![Testomat.io Report](${testomatLogoURL}) | ${statusEmoji(
    runParams.status,
  )} ${runParams.status.toUpperCase()} ${statusEmoji(runParams.status)} |
  | --- | --- |
  | **Tests** | ✔️ **${this.tests.length}** tests run |
  | **Summary** | ${statusEmoji('failed')} **${failedCount}** failed; ${statusEmoji(
    'passed',
  )} **${passedCount}** passed; **${statusEmoji('skipped')}** ${skippedCount} skipped |
  | **Duration** | 🕐 **${humanizeDuration(
    parseInt(
      this.tests.reduce((a, t) => a + (t.run_time || 0), 0),
      10,
    ),
    {
      maxDecimalPoints: 0,
    },
  )}** |
  `;

    if (this.ENV.BITBUCKET_BRANCH && this.ENV.BITBUCKET_COMMIT) {
      // eslint-disable-next-line max-len
      summary += `| **Job** | 👷 [#${this.ENV.BITBUCKET_BUILD_NUMBER}](https://bitbucket.org/${this.ENV.BITBUCKET_REPO_FULL_NAME}/pipelines/results/${this.ENV.BITBUCKET_BUILD_NUMBER}") by commit: **${this.ENV.BITBUCKET_COMMIT}** |`;
    }

    const failures = this.tests
      .filter(t => t.status === 'failed')
      .slice(0, 20)
      .map(t => {
        let text = `${statusEmoji('failed')} ${fullName(t)}\n`;
        if (t.message) {
          text += `> ${t.message
            .replace(/[^\x20-\x7E]/g, '')
            .replace(ansiRegExp(), '')
            .trim()}\n`;
        }
        if (t.stack) {
          text += `\n\`\`\`diff\n${t.stack
            .replace(ansiRegExp(), '')
            .replace(
              /^[\s\S]*################\[ Failure \]################/g,
              '################[ Failure ]################',
            )
            .trim()}\n\`\`\`\n`;
        }
        if (t.artifacts && t.artifacts.length && !this.ENV.TESTOMATIO_PRIVATE_ARTIFACTS) {
          t.artifacts
            .filter(f => !!f)
            .forEach(f => {
              if (f.endsWith('.png')) {
                text += `![Image](${f})\n`;
              } else {
                text += `[📄 ${path.basename(f)}](${f})\n`;
              }
            });
        }
        text += `\n---\n`;
        return text;
      });

    let body = summary;

    if (failures.length) {
      body += `\n🟥 **Failures (${failures.length})**\n\n* ${failures.join('\n* ')}\n`;
      if (failures.length > 10) {
        body += `\n> Notice: Only the first 10 failures are shown.`;
      }
    }

    if (this.tests.length > 0) {
      body += `\n\n**🐢 Slowest Tests**\n\n`;
      body += this.tests
        .sort((a, b) => b.run_time - a.run_time)
        .slice(0, 5)
        .map(t => `* **${fullName(t)}** (${humanizeDuration(parseFloat(t.run_time))})`)
        .join('\n');
    }

    // Construct Bitbucket API URL for comments
    // eslint-disable-next-line max-len
    const commentsRequestURL = `/repositories/${this.ENV.BITBUCKET_WORKSPACE}/${this.ENV.BITBUCKET_REPO_SLUG}/pullrequests/${this.ENV.BITBUCKET_PR_ID}/comments`;

    // Delete previous report
    await deletePreviousReport(this.client, commentsRequestURL, this.hiddenCommentData);

    // Add current report
    debug(`Adding comment via URL: ${commentsRequestURL}`);
    debug(`Final Bitbucket API call body: ${body}`);

    try {
      const addCommentResponse = await this.client.request({
        method: 'POST',
        url: commentsRequestURL,
        data: { content: { raw: body } },
      });

      const commentID = addCommentResponse.data.id;
      // eslint-disable-next-line max-len
      const commentURL = `https://bitbucket.org/${this.ENV.BITBUCKET_WORKSPACE}/${this.ENV.BITBUCKET_REPO_SLUG}/pull-requests/${this.ENV.BITBUCKET_PR_ID}#comment-${commentID}`;

      console.log(APP_PREFIX, pc.yellow('Bitbucket'), `Report created: ${pc.magenta(commentURL)}`);
    } catch (err) {
      console.error(
        APP_PREFIX,
        pc.yellow('Bitbucket'),
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

async function deletePreviousReport(client, commentsRequestURL, hiddenCommentData) {
  if (process.env.BITBUCKET_KEEP_OUTDATED_REPORTS) return;

  // Get comments
  let comments = [];

  try {
    const response = await client.request({
      method: 'GET',
      url: commentsRequestURL,
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
        await client.request({
          method: 'DELETE',
          url: deleteCommentURL,
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
