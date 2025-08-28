import createDebugMessages from 'debug';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import yaml from 'js-yaml';
import { minimatch } from 'minimatch';

import { APP_PREFIX } from './constants.js';

const debug = createDebugMessages('@testomatio/reporter:coverage');

export default class Coverage {
    constructor(opts = {}) {
        this.coverageFilePath = opts.filepath || undefined;
        if (!this.coverageFilePath) throw new Error('Coverage file path must be provided.');
        // this.coverageBranch = opts.branch || ""; TODO: for future

        this.client = opts.client || undefined;
        if (!this.client) throw new Error('Client must be provided.');

        this.parsedCoverage = {}
        this.changedFiles = [];
        this.tests = new Set();
        this.suiteIds = new Set();
        this.tagLabels = new Set();
    }

    getChangedFiles() {
        try {
            const diffOutput = execSync('git diff --name-only', {
                encoding: 'utf-8',
                stdio: ['pipe', 'pipe', 'ignore']
            });
            this.changedFiles = diffOutput
                .split('\n')
                .map(f => f.trim())
                .filter(Boolean);

            // Git edge case-1: No git diff changed files
            if (this.changedFiles.length === 0) {
                console.log(APP_PREFIX, 'ℹ️  No Git changed files detected. Skipping coverage processing.');
                return;
            }

            console.log(APP_PREFIX, `📑  GIT changed files:\n  - ${this.changedFiles.join('\n  - ')}`);
            return this.changedFiles;
        }
        catch (err) {
            const errorMessage = err.message || '';
            // Git edge case-2: Not a git repository or other error
            if (errorMessage.includes('Not a git repository')) {
                console.error(APP_PREFIX, '❌ Error: This folder is not a Git repository.');
            }
            else {
                console.error(APP_PREFIX, '❌ Failed to get Git changed files:', errorMessage);
            }

            return;
        }
    }

    validateCoverageFile() {
        // Validate the presence of the coverage filepath
        if (!fs.existsSync(this.coverageFilePath)) {
            console.log(APP_PREFIX, '❌ Coverage file not found:', this.coverageFilePath);
            return;
        }

        // Ensure the given path is a file (not a directory or other type)
        const stat = fs.statSync(this.coverageFilePath);
        if (!stat.isFile()) {
            console.log(APP_PREFIX, '❌ Provided coverage path is not a file:', this.coverageFilePath);
            return;
        }

        // Validate the file extension to be ".yml" to ensure it's a YAML file
        if (path.extname(this.coverageFilePath) !== ".yml") {
            console.log(APP_PREFIX, '❌ Coverage file must have a .yml extension:', this.coverageFilePath);
            return;
        }

        debug(`Coverage file is OK! (path = ${this.coverageFilePath})`);

        return this.coverageFilePath;
    }

    parseCoverageFile() {
        try {
            // Read the contents of the YAML file and attempt to parse the YAML into a JavaScript object
            const rawYml = fs.readFileSync(this.coverageFilePath, 'utf8');
            this.parsedCoverage = yaml.load(rawYml) || {};

            console.log(APP_PREFIX, `✅ Coverage file parsed successfully: ${this.coverageFilePath}`);

            return this.parsedCoverage;
        }
        catch (err) {
            console.error(APP_PREFIX, '❌ Failed to parse YAML:', err.message);
            return;
        }
    }

    extractRelevantTestIds() {
        const matchedLines = new Set();

        for (const changedFile of this.changedFiles) {
            for (const [pattern, ids] of Object.entries(this.parsedCoverage)) {
              if (minimatch(changedFile, pattern)) {
                matchedLines.add(changedFile);
      
                ids.forEach(id => {
                    // Example: "@Tt74099t1"
                    if (id.startsWith('@T')) {
                        this.tests.add(id.slice(1));
                    }
                    // Example: "@Sd74099c1"
                    else if (id.startsWith('@S')) {
                        this.suiteIds.add(id.slice(1));
                    }
                    // Example: "tag:@TestSmoke"
                    else if (id.startsWith('tag')) {
                        this.tagLabels.add(id.split(':')[1].slice(1));
                    }
                });
              }
            }
        }

        if (matchedLines.size === 0) {
            console.log(APP_PREFIX, 'ℹ️  No matching entries in coverage file for Git changes.');
            return;
        }

        debug(`Matched lines: ${matchedLines}`);

        return {
            tests: this.tests,
            suiteIds: this.suiteIds,
            tagLabels: this.tagLabels
        }
    }

    getGrepCommand() {
        //TODO: for Coverage v1 I get list of suiteIds & tests -> maybe I should get list of suite tests from the server in future???
        const combinedTests = new Set([...this.tests, ...this.suiteIds]);

        if (combinedTests.size === 0) {
          console.log(APP_PREFIX, 'ℹ️  No tests found for execution based on Git changes and coverage.');
          return;
        }
    
        const grepPattern = [...combinedTests].join('|');
        debug(`Full -grep command: --grep "(${grepPattern})"`);

        return ` --grep "(${grepPattern})"`; //TODO: or ` --grep (${grepPattern})` ???
    }

    async resolveTestIdsFromAttributes() {
        await this._resolveAttributeSet(this.tagLabels, 'tag-name');
        // await this._resolveAttributeSet(this.suiteIds, 'suite'); // for the future -> get list of all suite tests
    }    

    async _resolveAttributeSet(set, type) {
        try {
            const promises = [...set].map(async val =>
                this.client.prepareRun({ pipe: "testomatio", pipeOptions: `${type}=${val}` }) // OR use as in filter: tag-name=smoke
                    .then(tests => {
                        if (Array.isArray(tests) && tests.length > 0) {
                            tests.forEach(testId => this.tests.add(testId));
                        }
                        else {
                            console.log(APP_PREFIX, `🔍 No test by ${type}=${val} were found on the server side`);
                        }
                    })
            );

            await Promise.all(promises);
        }
        catch (err) {
            console.log(APP_PREFIX, `❌ Failed to retrieve the list of TAGGED tests: ${err}`);
        }
    }
}