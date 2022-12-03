const chalk = require('chalk');
const { Octokit } = require("@octokit/rest");
const { APP_PREFIX } = require('../constants');
const { ansiRegExp, isSameTest } = require('../util');
const merge = require('lodash.merge');


class GitHubPipe {

  isEnabled = false;

  constructor(params, store = {}) {
    this.store = store;
    this.tests = []
    this.token = params.GH_PAT || process.env.GH_PAT;
    this.ref = process.env.GITHUB_REF
    this.repo = process.env.GITHUB_ACTION_REPOSITORY
    if (!this.token || !this.ref || !this.repo) return;
    this.isEnabled = true;
    this.issue = this.ref.match(/refs\/pull\/(\d+)\/merge/)[1]    
    this.start = new Date();
  }
  
  async createRun() {}

  updateRun() {}

  addTest(test) {
    if (!this.isEnabled) return;

    const index = this.tests.findIndex(t => isSameTest(t, test))    
    // update if they were already added
    if (index >= 0) {
      this.tests[index] = merge(this.tests[index], test);
      return;
    }

    this.tests.push(test)
  }

  async finishRun(runParams) {
    if (!this.isEnabled) return;

    if (runParams.tests) runParams.tests.forEach(t => this.addTest(t));
    

    this.octokit = new Octokit({
      auth: this.token,
    });

    const [owner, repo] = this.repo.split('/');
    if (!(owner || repo)) return;

    // ... create a comment on GitHub
    const passedCount = this.tests.filter(t => t.status === 'passed').length;
    const failedCount = this.tests.filter(t => t.status === 'failed').length;
    const skippedCount = this.tests.filter(t => t.status === 'skipped').length;

    let summary = `
### Run Report

|  | ${statusEmoji(runParams.status)} ${runParams.status.toUpperCase()} ${statusEmoji(runParams.status)} |
| --- | --- |        
| Tests | ✔️  **${this.tests.length}** tests run  |
| Summary | ${statusEmoji('failed')} **${failedCount}** failed; ${statusEmoji('passed')} **${passedCount}** passed; **${statusEmoji('skipped')}** ${skippedCount} skipped |
| Duration | 🕐  **${parseFloat(this.tests.reduce((a, t) => a + (t.run_time || 0), 0)).toFixed(2)}**ms |
`
    if (this.store.runUrl) {
      summary += `| Testomat.io Report | 📊 [Run #${this.store.runId}](${this.store.runUrl})  | `;
    }
    if (process.env.GITHUB_WORKFLOW) {
      summary += `| Workflow | 🗂️  ${process.env.GITHUB_WORKFLOW} | `;
    }
    if (process.env.RUNNER_OS) {
      summary += `| Operating System | 🖥️ \`${process.env.RUNNER_OS}\` ${process.env.RUNNER_ARCH || ''} | `;
    }
    if (process.env.GITHUB_HEAD_REF) {
      summary += `| Branch | 🌳  \`${process.env.GITHUB_HEAD_REF}\` | `;
    }
    if (process.env.GITHUB_RUN_ATTEMPT) {
      summary += `| Run Attempt | 🌒  \`${process.env.GITHUB_RUN_ATTEMPT}\` | `;
    }
    if (process.env.GITHUB_RUN_ID) {
      summary += `| Build Log | ✒️  ${process.env.GITHUB_SERVER_URL || 'https://github.com'}/${this.repo}/actions/runs/${process.env.GITHUB_RUN_ID} | `;
    }


    const failures = this.tests.filter(t => t.status === 'failed').slice(0, 20).map(t => {
      let text = `#### ${statusEmoji('failed')} ${fullName(t)} `;
      text += "\n\n"
      if (t.message) text += "> " + t.message.replace(/[^\x20-\x7E]/g, '').replace(ansiRegExp(), '').trim() + "\n"
      if (t.stack) text += "```diff\n" + t.stack.replace(ansiRegExp(), '').trim() + "\n```\n";
      
      if (t.artifacts && t.artifacts.length && !process.env.TESTOMATIO_PRIVATE_ARTIFACTS) {
        t.artifacts.filter(f => f.endsWith('.png')).forEach(f => {
          if (f.endsWith('.png')) return text+= `![](${f})\n`    
        });
      }

      text += "\n---\n"

      return text;
    })
    
    let body = summary;

    if (failures.length) {
      body += `<details>\n<summary>### 🟥 Failures (${failures.length})</summary>\n${failures.join('\n')} </details>`;
    }

    if (failures.length > 20) {
      body += "\n> Notice\n> Only first 20 failures shown*"
    }

    if (this.tests.length > 0) {
      body += "\n### 🐢 Slowest Tests\n\n"
      body += this.tests.sort((a, b) => b?.run_time - a?.run_time).slice(0, 5).map(t => {
        return `* ${fullName(t)} (${parseFloat(t.run_time).toFixed(2)}ms)`
      }).join('\n')
    }

    try {
      const resp = await this.octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: this.issue,
        body,
      });
  
      const url = resp.data?.html_url;
      this.store.githubUrl = url;
  
      console.log(
        APP_PREFIX,
        chalk.yellow('GitHub'),
        `Report created: ${chalk.magenta(url)}`,
      );
    } catch (err) {
      console.log(
        APP_PREFIX,
        chalk.yellow('GitHub'),
        `Couldn't create GitHub report ${err}`,
      );
    }
  }
}

function statusEmoji(status) {
  if (status === 'passed') return '🟢';
  if (status === 'failed') return '🔴';
  if (status === 'skipped') return '🟡';
  return ''
}

function fullName(t) {
  let line = '';
  if (t.suite_title) line = `${t.suite_title}: `; 
  line += `**${t.title}**`  
  if (t.example) line += ` \`[${Object.values(t.example)}]\``;
  return line;
}

module.exports = GitHubPipe;