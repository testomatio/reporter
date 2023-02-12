// const path = require('path');
// const chalk = require('chalk');
// const humanizeDuration = require("humanize-duration");
// const merge = require('lodash.merge');
// const { APP_PREFIX } = require('../constants');
// const { ansiRegExp, isSameTest } = require('../util');


// https://gitlab.com/api/v4/projects/43305018/merge_requests/1/notes?access_token=glpat-Ny3oKzVzYjMRZ5Sw9ja5


class GitLabPipe {

  isEnabled = false;

  // constructor(params, store = {}) {
  constructor() {
    console.warn(` - - - - - - - - - GITLAB PIPE - - - - - - - - - `);
    console.warn('CI_PROJECT_ID:', process.env.CI_PROJECT_ID);
    console.warn('CI_MERGE_REQUEST_ID:', process.env.CI_MERGE_REQUEST_ID);
    console.warn(`= = = = = = = = = = `);
    // console.warn(process.env.GITLAB_PAT);
    // this.store = store;
//     this.tests = []
//     this.token = params.GH_PAT || process.env.GH_PAT;
//     this.ref = process.env.GITHUB_REF
//     this.repo = process.env.GITHUB_REPOSITORY

    this.projectID = process.env.CI_PROJECT_ID;
    this.mergeRequestID = process.env.CI_MERGE_REQUEST_ID;
    this.gitlabPAT = process.env.GITLAB_PAT;
    this.token = this.gitlabPAT;

//     if (process.env.DEBUG) {
//       console.log(APP_PREFIX, 'GitHub Pipe: ', this.token ? 'TOKEN' : '*no token*', this.ref, this.repo);  
//     }

    if (!this.token || !this.projectID || !this.mergeRequestID) return;
//     this.isEnabled = true;
//     const matchedIssue = this.ref.match(/refs\/pull\/(\d+)\/merge/);
//     if (!matchedIssue) return;
//     this.issue = matchedIssue[1]    
//     this.start = new Date();

//     if (process.env.DEBUG) {
//       console.log(APP_PREFIX, 'GitHub Pipe: Enabled');  
//     }
  }
  
//   async createRun() {}

//   updateRun() {}

//   addTest(test) {
//     if (!this.isEnabled) return;

//     const index = this.tests.findIndex(t => isSameTest(t, test))    
//     // update if they were already added
//     if (index >= 0) {
//       this.tests[index] = merge(this.tests[index], test);
//       return;
//     }

//     this.tests.push(test)
//   }

//   async finishRun(runParams) {
//     if (!this.isEnabled) return;

//     if (runParams.tests) runParams.tests.forEach(t => this.addTest(t));
    

//     this.octokit = new Octokit({
//       auth: this.token,
//     });

//     const [owner, repo] = this.repo.split('/');
//     if (!(owner || repo)) return;

//     // ... create a comment on GitHub
//     const passedCount = this.tests.filter(t => t.status === 'passed').length;
//     const failedCount = this.tests.filter(t => t.status === 'failed').length;
//     const skippedCount = this.tests.filter(t => t.status === 'skipped').length;

//     let summary = `

// | [![Testomat.io Report](https://avatars.githubusercontent.com/u/59105116?s=36&v=4)](https://testomat.io)  | ${statusEmoji(runParams.status)} ${runParams.status.toUpperCase()} ${statusEmoji(runParams.status)} |
// | --- | --- |        
// | Tests | ✔️  **${this.tests.length}** tests run  |
// | Summary | ${statusEmoji('failed')} **${failedCount}** failed; ${statusEmoji('passed')} **${passedCount}** passed; **${statusEmoji('skipped')}** ${skippedCount} skipped |
// | Duration | 🕐  **${humanizeDuration(parseFloat(this.tests.reduce((a, t) => a + (t.run_time || 0), 0)))}** |
// `
//     if (this.store.runUrl) {
//       summary += `| Testomat.io Report | 📊 [Run #${this.store.runId}](${this.store.runUrl})  | `;
//     }
//     if (process.env.GITHUB_WORKFLOW) {
//       summary += `| Workflow | 🗂️  ${process.env.GITHUB_WORKFLOW} | `;
//     }
//     if (process.env.RUNNER_OS) {
//       summary += `| Operating System | 🖥️ \`${process.env.RUNNER_OS}\` ${process.env.RUNNER_ARCH || ''} | `;
//     }
//     if (process.env.GITHUB_HEAD_REF) {
//       summary += `| Branch | 🌳  \`${process.env.GITHUB_HEAD_REF}\` | `;
//     }
//     if (process.env.GITHUB_RUN_ATTEMPT) {
//       summary += `| Run Attempt | 🌒  \`${process.env.GITHUB_RUN_ATTEMPT}\` | `;
//     }
//     if (process.env.GITHUB_RUN_ID) {
//       summary += `| Build Log | ✒️  ${process.env.GITHUB_SERVER_URL || 'https://github.com'}/${this.repo}/actions/runs/${process.env.GITHUB_RUN_ID} | `;
//     }


//     const failures = this.tests.filter(t => t.status === 'failed').slice(0, 20).map(t => {
//       let text = `#### ${statusEmoji('failed')} ${fullName(t)} `;
//       text += "\n\n"
//       if (t.message) text += "> " + t.message.replace(/[^\x20-\x7E]/g, '').replace(ansiRegExp(), '').trim() + "\n"
//       if (t.stack) text += "```diff\n" + t.stack.replace(ansiRegExp(), '').trim() + "\n```\n";
      
//       if (t.artifacts && t.artifacts.length && !process.env.TESTOMATIO_PRIVATE_ARTIFACTS) {
//         t.artifacts.filter(f => !!f).filter(f => f.endsWith('.png')).forEach(f => {
//           if (f.endsWith('.png')) return text+= `![](${f})\n`    
//           return text+= `[📄 ${path.basename(f)}](${f})\n`    
//         });
//       }

//       text += "\n---\n"

//       return text;
//     })
    
//     let body = summary;

//     if (failures.length) {
//       body += `\n<details>\n<summary><h3>🟥 Failures (${failures.length})</h4></summary>\n\n${failures.join('\n')}\n`;
//       if (failures.length > 20) {
//         body += "\n> Notice\n> Only first 20 failures shown*"
//       }
//       body += "\n\n</details>";
//     }

//     if (this.tests.length > 0) {
//       body += "\n<details>\n<summary><h3>🐢 Slowest Tests</h3></summary>\n\n"
//       body += this.tests.sort((a, b) => b?.run_time - a?.run_time).slice(0, 5).map(t => {
//         return `* ${fullName(t)} (${humanizeDuration(parseFloat(t.run_time))})`
//       }).join('\n')
//       body += "\n</details>"
//     }

//     try {
//       const resp = await this.octokit.rest.issues.createComment({
//         owner,
//         repo,
//         issue_number: this.issue,
//         body,
//       });
  
//       const url = resp.data?.html_url;
//       this.store.githubUrl = url;
  
//       console.log(
//         APP_PREFIX,
//         chalk.yellow('GitHub'),
//         `Report created: ${chalk.magenta(url)}`,
//       );
//     } catch (err) {
//       console.log(
//         APP_PREFIX,
//         chalk.yellow('GitHub'),
//         `Couldn't create GitHub report ${err}`,
//       );
//     }
//   }

//   toString() {
//     return 'GitHub Reporter'
//   }
}

// function statusEmoji(status) {
//   if (status === 'passed') return '🟢';
//   if (status === 'failed') return '🔴';
//   if (status === 'skipped') return '🟡';
//   return ''
// }

// function fullName(t) {
//   let line = '';
//   if (t.suite_title) line = `${t.suite_title}: `; 
//   line += `**${t.title}**`  
//   if (t.example) line += ` \`[${Object.values(t.example)}]\``;
//   return line;
// }

module.exports = GitLabPipe;
