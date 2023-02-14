const { ansiRegExp, isSameTest } = require('../util');
const { APP_PREFIX } = require('../constants');
const chalk = require('chalk');
const got = require('got');
const humanizeDuration = require('humanize-duration');
const merge = require('lodash.merge');
const path = require('path');

// console.log(APP_PREFIX, chalk.yellow('GitLab'), `Report created: ${chalk.magenta(url)}`);

class GitLabPipe {
  isEnabled = false;

  constructor(params, store = {}) {
    console.warn(' - - - - - -');
    console.warn(' GITLAB REPORTER: 26');
    console.warn(' - - - - - -');
    // TODO: make sure your variables are available inside CI (Gitlab hides variables for unprotected branches by default)
    this.store = store;
    this.tests = [];
    this.token = params.GITLAB_PAT || process.env.GITLAB_PAT;
    this.CI_MERGE_REQUEST_IID = process.env.CI_MERGE_REQUEST_IID;
    this.CI_PROJECT_ID = process.env.CI_PROJECT_ID;
    this.CI_PROJECT_URL = process.env.CI_PROJECT_URL;

    if (process.env.DEBUG) {
      console.log(
        APP_PREFIX,
        'GitLab Pipe:',
        this.token ? 'TOKEN passed' : '*no token*',
        `Project id: ${this.CI_PROJECT_ID}, MR id: ${this.CI_MERGE_REQUEST_IID}`,
      );
    }

    if (!this.CI_PROJECT_ID || !this.CI_MERGE_REQUEST_IID) {
      console.warn(
        `Token passed for GitLab Pipe, but CI pipeline should be run in Merge Request to have ability to add the report.`,
      );
      return;
    }

    if (!this.token) {
      console.warn(`Hint: GitLab CI variables are unavailable for unprotected branches by default.`);
      return;
    }

    this.isEnabled = true;

    if (process.env.DEBUG) {
      console.log(APP_PREFIX, 'GitLab Pipe: Enabled');
    }
  }

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

    let summary = `

  | [![Testomat.io Report](https://avatars.githubusercontent.com/u/59105116?s=36&v=4)](https://testomat.io)  | ${statusEmoji(
    runParams.status,
  )} ${runParams.status.toUpperCase()} ${statusEmoji(runParams.status)} |
  | --- | --- |
  | Tests | ✔️  **${this.tests.length}** tests run  |
  | Summary | ${statusEmoji('failed')} **${failedCount}** failed; ${statusEmoji(
      'passed',
    )} **${passedCount}** passed; **${statusEmoji('skipped')}** ${skippedCount} skipped |
  | Duration | 🕐  **${humanizeDuration(parseFloat(this.tests.reduce((a, t) => a + (t.run_time || 0), 0)))}** |
  `;

    // $CI_JOB_STAGE
    // test

    // echo $CI_JOB_STATUS
    // running

    // pipeline URL
    // https://gitlab.com/olexandr13/testomatio-test/-/pipelines/776361767

    // let jobInfo = '';
    // if (CI_JOB_NAME) {
    //   jobInfo += `Name: ${this.CI_JOB_NAME}`;
    // }
    // if (CI_JOB_ID) {
    //   jobInfo += `ID: ${this.CI_JOB_ID}[${this.CI_JOB_ID}](${this.CI_JOB_URL})`;
    // }

    this.CI_JOB_NAME = process.env.CI_JOB_NAME;
    this.CI_JOB_ID = process.env.CI_JOB_ID;
    this.CI_JOB_STAGE = process.env.CI_JOB_STAGE;
    this.CI_JOB_URL = process.env.CI_JOB_URL;
    this.CI_JOB_STATUS = process.env.CI_JOB_STATUS;
    // TODO
    if (true) {
      summary += `| Job | 👷 Name: ${this.CI_JOB_NAME} <br>[${this.CI_JOB_ID}](${this.CI_JOB_URL})<br>Stage: ${this.CI_JOB_STAGE}<br>Status: ${this.CI_JOB_STATUS} | `;
    }

    const failures = this.tests
      .filter(t => t.status === 'failed')
      .slice(0, 20)
      .map(t => {
        let text = `#### ${statusEmoji('failed')} ${fullName(t)} `;
        text += '\n\n';
        if (t.message)
          text +=
            '> ' +
            t.message
              .replace(/[^\x20-\x7E]/g, '')
              .replace(ansiRegExp(), '')
              .trim() +
            '\n';
        if (t.stack) text += '```diff\n' + t.stack.replace(ansiRegExp(), '').trim() + '\n```\n';

        if (t.artifacts && t.artifacts.length && !process.env.TESTOMATIO_PRIVATE_ARTIFACTS) {
          t.artifacts
            .filter(f => !!f)
            .filter(f => f.endsWith('.png'))
            .forEach(f => {
              if (f.endsWith('.png')) return (text += `![](${f})\n`);
              return (text += `[📄 ${path.basename(f)}](${f})\n`);
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
        .sort((a, b) => b?.run_time - a?.run_time)
        .slice(0, 5)
        .map(t => {
          return `* ${fullName(t)} (${humanizeDuration(parseFloat(t.run_time))})`;
        })
        .join('\n');
      body += '\n</details>';
    }

    try {
      const addCommentURL = `https://gitlab.com/api/v4/projects/${this.CI_PROJECT_ID}/merge_requests/${this.CI_MERGE_REQUEST_IID}/notes?access_token=${this.token}`;
      console.info(`Adding comment via url: ${addCommentURL}`);
      const options = {
        json: {
          body,
        },
      };

      const response = await got.post(addCommentURL, options);
      console.warn(response.statusCode);
      console.warn(response.body);

      // https://gitlab.com/olexandr13/testomatio-test/-/merge_requests/2#note_1275344504
      const commentURL = `${this.CI_PROJECT_URL}/-/merge_requests/${this.CI_MERGE_REQUEST_IID}#note_${response.body.id}`;

      console.log(APP_PREFIX, chalk.yellow('GitLab'), `Report created: ${chalk.magenta(commentURL)}`);
    } catch (err) {
      console.log(APP_PREFIX, chalk.yellow('GitLab'), `Couldn't create GitLab report ${err}.
      Reqest url: ${addCommentURL}
      Request data: ${JSON.stringify(options)}`);
    }
  }

  toString() {
    return 'GitLab Reporter';
  }

  updateRun() {}
}

function statusEmoji(status) {
  if (status === 'passed') return '🟢';
  if (status === 'failed') return '🔴';
  if (status === 'skipped') return '🟡';
  return '';
}

function fullName(t) {
  let line = '';
  if (t.suite_title) line = `${t.suite_title}: `;
  line += `**${t.title}**`;
  if (t.example) line += ` \`[${Object.values(t.example)}]\``;
  return line;
}

module.exports = GitLabPipe;
