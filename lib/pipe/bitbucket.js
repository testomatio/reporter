"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BitbucketPipe = void 0;
const constants_js_1 = require("../constants.js");
const utils_js_1 = require("../utils/utils.js");
const pipe_utils_js_1 = require("../utils/pipe_utils.js");
const axios_1 = __importDefault(require("axios"));
const picocolors_1 = __importDefault(require("picocolors"));
const humanize_duration_1 = __importDefault(require("humanize-duration"));
const lodash_merge_1 = __importDefault(require("lodash.merge"));
const path_1 = __importDefault(require("path"));
const debug_1 = __importDefault(require("debug"));
const debug = (0, debug_1.default)('@testomatio/reporter:pipe:bitbucket');
//! BITBUCKET_ACCESS_TOKEN environment variable is required for this functionality to work
//! and your pipeline trigger should be a pull request
/**
 * @class BitbucketPipe
 * @typedef {import('../../types/types.js').Pipe} Pipe
 * @typedef {import('../../types/types.js').TestData} TestData
 */
class BitbucketPipe {
    constructor(params, store = {}) {
        this.isEnabled = false;
        this.ENV = process.env;
        this.store = store;
        this.tests = [];
        // Bitbucket PAT looks like bbpat-*****
        this.token = params.BITBUCKET_ACCESS_TOKEN || process.env.BITBUCKET_ACCESS_TOKEN || this.ENV.BITBUCKET_ACCESS_TOKEN;
        this.hiddenCommentData = `Testomat.io report: ${process.env.BITBUCKET_BRANCH || ''}`;
        debug(picocolors_1.default.yellow('Bitbucket Pipe:'), this.token ? 'TOKEN passed' : '*no token*', `Project key: ${this.ENV.BITBUCKET_PROJECT_KEY}, Pull request ID: ${this.ENV.BITBUCKET_PR_ID}`);
        if (!this.token) {
            debug(`Hint: Bitbucket CI variables are unavailable for unprotected branches by default.`);
            return;
        }
        this.isEnabled = true;
        debug('Bitbucket Pipe: Enabled');
    }
    async cleanLog(log) {
        const stripAnsi = (await Promise.resolve().then(() => __importStar(require('strip-ansi')))).default;
        return stripAnsi(log);
    }
    // Prepare the run (if needed)
    async prepareRun() { }
    // Create a new run (if needed)
    async createRun() { }
    addTest(test) {
        if (!this.isEnabled)
            return;
        const index = this.tests.findIndex(t => (0, utils_js_1.isSameTest)(t, test));
        // Update if they were already added
        if (index >= 0) {
            this.tests[index] = (0, lodash_merge_1.default)(this.tests[index], test);
            return;
        }
        this.tests.push(test);
    }
    async finishRun(runParams) {
        if (!this.isEnabled)
            return;
        if (runParams.tests)
            runParams.tests.forEach(t => this.addTest(t));
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
    
  | ![Testomat.io Report](${constants_js_1.testomatLogoURL}) | ${(0, pipe_utils_js_1.statusEmoji)(runParams.status)} ${runParams.status.toUpperCase()} ${(0, pipe_utils_js_1.statusEmoji)(runParams.status)} |
  | --- | --- |
  | **Tests** | ✔️ **${this.tests.length}** tests run |
  | **Summary** | ${(0, pipe_utils_js_1.statusEmoji)('failed')} **${failedCount}** failed; ${(0, pipe_utils_js_1.statusEmoji)('passed')} **${passedCount}** passed; **${(0, pipe_utils_js_1.statusEmoji)('skipped')}** ${skippedCount} skipped |
  | **Duration** | 🕐 **${(0, humanize_duration_1.default)(parseInt(this.tests.reduce((a, t) => a + (t.run_time || 0), 0), 10), {
            maxDecimalPoints: 0,
        })}** |
  `;
        if (this.ENV.BITBUCKET_BRANCH && this.ENV.BITBUCKET_COMMIT) {
            // eslint-disable-next-line max-len
            summary += `| **Job** | 👷 [#${this.ENV.BITBUCKET_BUILD_NUMBER}](https://bitbucket.org/${this.ENV.BITBUCKET_REPO_FULL_NAME}/pipelines/results/${this.ENV.BITBUCKET_BUILD_NUMBER}") by commit: **${this.ENV.BITBUCKET_COMMIT}** |`;
        }
        const failures = this.tests
            .filter(t => t.status === 'failed')
            .slice(0, 20)
            .map(t => {
            let text = `${(0, pipe_utils_js_1.statusEmoji)('failed')} ${(0, pipe_utils_js_1.fullName)(t)}\n`;
            if (t.message) {
                text += `> ${t.message
                    .replace(/[^\x20-\x7E]/g, '')
                    .replace((0, utils_js_1.ansiRegExp)(), '')
                    .trim()}\n`;
            }
            if (t.stack) {
                text += `\n\`\`\`diff\n${t.stack
                    .replace((0, utils_js_1.ansiRegExp)(), '')
                    .replace(/^[\s\S]*################\[ Failure \]################/g, '################[ Failure ]################')
                    .trim()}\n\`\`\`\n`;
            }
            if (t.artifacts && t.artifacts.length && !this.ENV.TESTOMATIO_PRIVATE_ARTIFACTS) {
                t.artifacts
                    .filter(f => !!f)
                    .forEach(f => {
                    if (f.endsWith('.png')) {
                        text += `![Image](${f})\n`;
                    }
                    else {
                        text += `[📄 ${path_1.default.basename(f)}](${f})\n`;
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
                .map(t => `* **${(0, pipe_utils_js_1.fullName)(t)}** (${(0, humanize_duration_1.default)(parseFloat(t.run_time))})`)
                .join('\n');
        }
        // Construct Bitbucket API URL for comments
        // eslint-disable-next-line max-len
        const commentsRequestURL = `https://api.bitbucket.org/2.0/repositories/${this.ENV.BITBUCKET_WORKSPACE}/${this.ENV.BITBUCKET_REPO_SLUG}/pullrequests/${this.ENV.BITBUCKET_PR_ID}/comments`;
        // Delete previous report
        await deletePreviousReport(axios_1.default, commentsRequestURL, this.hiddenCommentData, this.token);
        // Add current report
        debug(`Adding comment via URL: ${commentsRequestURL}`);
        debug(`Final Bitbucket API call body: ${body}`);
        try {
            const addCommentResponse = await axios_1.default.post(commentsRequestURL, { content: { raw: body } }, {
                headers: {
                    Authorization: `Bearer ${this.token}`,
                    'Content-Type': 'application/json',
                },
            });
            const commentID = addCommentResponse.data.id;
            // eslint-disable-next-line max-len
            const commentURL = `https://bitbucket.org/${this.ENV.BITBUCKET_WORKSPACE}/${this.ENV.BITBUCKET_REPO_SLUG}/pull-requests/${this.ENV.BITBUCKET_PR_ID}#comment-${commentID}`;
            console.log(constants_js_1.APP_PREFIX, picocolors_1.default.yellow('Bitbucket'), `Report created: ${picocolors_1.default.magenta(commentURL)}`);
        }
        catch (err) {
            console.error(constants_js_1.APP_PREFIX, picocolors_1.default.yellow('Bitbucket'), `Couldn't create Bitbucket report\n${err}.
      Request URL: ${commentsRequestURL}
      Request data: ${body}`);
        }
    }
    toString() {
        return 'Bitbucket Reporter';
    }
    updateRun() { }
}
exports.BitbucketPipe = BitbucketPipe;
async function deletePreviousReport(axiosInstance, commentsRequestURL, hiddenCommentData, token) {
    if (process.env.BITBUCKET_KEEP_OUTDATED_REPORTS)
        return;
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
    }
    catch (e) {
        console.error('Error while attempting to retrieve comments on Bitbucket Pull Request:\n', e);
    }
    if (!comments.length)
        return;
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
            }
            catch (e) {
                console.warn(`Can't delete previously added comment with testomat.io report. Ignored.`);
            }
            // Pass next env var if need to clear all previous reports;
            // only the last one is removed by default
            if (!process.env.BITBUCKET_REMOVE_ALL_OUTDATED_REPORTS)
                break;
            // TODO: in case of many reports should implement pagination
        }
    }
}

module.exports.BitbucketPipe = BitbucketPipe;
