const debug = require('debug')('@testomatio/reporter:pipe:github');
const path = require('path');
const chalk = require('chalk');
const humanizeDuration = require('humanize-duration');
const merge = require('lodash.merge');
const { Octokit } = require('@octokit/rest');
const { APP_PREFIX, testomatLogoURL } = require('../constants');
const { ansiRegExp, isSameTest } = require('../utils/utils');
const { statusEmoji, fullName } = require('../utils/pipe_utils');

/**
 * @typedef {import('../../types').Pipe} Pipe
 * @typedef {import('../../types').TestData} TestData
 * @class GitHubPipe
 * @implements {Pipe}
 */
class GitHubPipe {
  constructor(params, store = {}) {
    this.isEnabled = false;
    this.store = store;
    this.tests = [];
    this.token = params.GH_PAT || process.env.GH_PAT;
    this.ref = process.env.GITHUB_REF;
    this.repo = process.env.GITHUB_REPOSITORY;
    this.jobKey = `${process.env.GITHUB_WORKFLOW || ''} / ${process.env.GITHUB_JOB || ''}`;
    this.hiddenCommentData = `<!--- testomat.io report ${this.jobKey} -->`;

    debug('GitHub Pipe: ', this.token ? 'TOKEN' : '*no token*', 'Ref:', this.ref, 'Repo:', this.repo);

    if (!this.token || !this.ref || !this.repo) return;
    this.isEnabled = true;
    const matchedIssue = this.ref.match(/refs\/pull\/(\d+)\/merge/);
    if (!matchedIssue) return;
    this.issue = parseInt(matchedIssue[1], 10);

    this.start = new Date();

    debug('GitHub Pipe: Enabled');
  }

  // TODO: to using SET opts as argument => prepareRun(opts)
  async prepareRun() {}

  async createRun() {}

  addTest(test) {
    if (!this.isEnabled) return;
    debug('Adding test:', test);

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
    if (!this.issue) return;

    if (runParams.tests) runParams.tests.forEach(t => this.addTest(t));

    this.octokit = new Octokit({
      auth: this.token,
    });

    const [owner, repo] = (this.repo || '').split('/');
    if (!(owner || repo)) return;

    // ... create a comment on GitHub
    const passedCount = this.tests.filter(t => t.status === 'passed').length;
    const failedCount = this.tests.filter(t => t.status === 'failed').length;
    const skippedCount = this.tests.filter(t => t.status === 'skipped').length;

    let summary = `${this.hiddenCommentData}

| [![Testomat.io Report](${testomatLogoURL})](https://testomat.io)  | ${statusEmoji(
      runParams.status,
    )} ${`${process.env.GITHUB_JOB} ${runParams.status}`.toUpperCase()} |
| --- | --- |        
| Tests | ✔️  **${this.tests.length}** tests run  |
| Summary | ${failedCount ? `${statusEmoji('failed')} **${failedCount}** failed; ` : ''} ${statusEmoji(
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
    )}** |`;

    if (this.store.runUrl) {
      summary += `\n| Testomat.io Report | 📊 [Run #${this.store.runId}](${this.store.runUrl})  | `;
    }
    if (process.env.GITHUB_WORKFLOW) {
      summary += `\n| Job | 🗂️  [${this.jobKey}](${process.env.GITHUB_SERVER_URL || 'https://github.com'}/${
        this.repo
      }/actions/runs/${process.env.GITHUB_RUN_ID}) | `;
    }
    if (process.env.RUNNER_OS) {
      summary += `\n| Operating System | 🖥️ \`${process.env.RUNNER_OS}\` ${process.env.RUNNER_ARCH || ''} | `;
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

        if (t.artifacts && t.artifacts.length && !process.env.TESTOMATIO_PRIVATE_ARTIFACTS) {
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

    await deletePreviousReport(this.octokit, owner, repo, this.issue, this.hiddenCommentData);

    // add report as comment
    try {
      debug('Adding comment\n', body);
      const resp = await this.octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: this.issue,
        body,
      });

      const url = resp.data?.html_url;
      debug('Comment URL:', url);
      this.store.githubUrl = url;

      console.log(APP_PREFIX, chalk.yellow('GitHub'), `Report created: ${chalk.magenta(url)}`);
    } catch (err) {
      console.log(APP_PREFIX, chalk.yellow('GitHub'), `Couldn't create GitHub report ${err}`);
    }
  }

  toString() {
    return 'GitHub Reporter';
  }
}

async function deletePreviousReport(octokit, owner, repo, issue, hiddenCommentData) {
  if (process.env.GH_KEEP_OUTDATED_REPORTS) return;

  // get comments
  let comments = [];
  try {
    const response = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: issue,
    });
    comments = response.data;
  } catch (e) {
    console.error('Error while attempt to retrieve comments on GitHub Pull Request:\n', e);
  }

  if (!comments.length) return;

  for (const comment of comments) {
    // if comment was left by the same workflow
    if (comment.body.includes(hiddenCommentData)) {
      try {
        // delete previous comment
        await octokit.rest.issues.deleteComment({
          owner,
          repo,
          issue_number: issue,
          comment_id: comment.id,
        });
      } catch (e) {
        console.warn(`Can't delete previously added comment with testomat.io report. Ignore.`);
      }

      // pass next env var if need to clear all previous reports;
      // only the last one is removed by default
      if (!process.env.GITHUB_REMOVE_ALL_OUTDATED_REPORTS) break;
      // TODO: in case of many reports should implement pagination
    }
  }
}

module.exports = GitHubPipe;
