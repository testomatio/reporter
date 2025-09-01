import createDebugMessages from 'debug';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import yaml from 'js-yaml';
import { minimatch } from 'minimatch';

import { APP_PREFIX } from './constants.js';

const debug = createDebugMessages('@testomatio/reporter:coverage');

export default class Coverage {
    #GIT_COMMANDS = {
        committed: 'git show --name-only --pretty="" HEAD', //TODO: by number of commits like HEAD~3 ???
        uncommitted: 'git diff --name-only'
    }
    #GIT_DEFAULT_MARKER = 'uncommitted';

    constructor(opts = {}) {
        this.coverageFilePath = opts.filepath || undefined;
        if (!this.coverageFilePath) throw new Error('Coverage file path must be provided.');
        this.changesOption = opts.changes || this.#GIT_DEFAULT_MARKER; // Default = "uncommitted" if not provided
        // this.coverageBranch = opts.branch || ""; TODO: for future

        this.client = opts.client || undefined;
        if (!this.client) throw new Error('Client must be provided.');

        this.parsedCoverage = {}
        this.changedFiles = [];
        this.tests = new Set();
        this.suiteIds = new Set();
        this.tagLabels = new Set();
    }

    /**
     * Executes a Git command to retrieve a list of changed files.
     *
     * @param {string} cmd - The Git command to execute.
     * @returns {string[]} An array of changed file paths. Returns an empty array if an error occurs
     * (e.g., not a Git repository or command failure).
     */
    #getChangedFilesFromGit(cmd) {
        try {
            const result = execSync(cmd, {
                encoding: 'utf-8',
                stdio: ['pipe', 'pipe', 'ignore']
            });
    
            return result
                .split('\n')
                .map(f => f.trim())
                .filter(Boolean);
        } 
        catch (err) {
            const errorMessage = err.message || '';
            // Git edge: Not a git repository or other error
            if (errorMessage.includes('Not a git repository')) {
                console.error(APP_PREFIX, '❌ Error: This folder is not a Git repository.');
            } else {
                console.error(APP_PREFIX, `❌ Git command failed ("${cmd}"):\n`, errorMessage);
            }
    
            return [];
        }
    }

    /**
     * Retrieves a list of changed Git files based on the selected `changesOption`.
     * 
     * - If `changesOption` is `"committed"` -> 'git show --name-only --pretty="" HEAD': it gets files from the latest commit (`HEAD`).
     * - If `changesOption` is `"uncommitted"` (default) -> 'git diff --name-only' cmd: it gets staged/unstaged changes in the working directory.
     * Logs a message if no changes are detected.
     * 
     * @returns {this|undefined} The current instance if success, or `undefined` if no changes are found.
     */
    getGitChangedFiles() {
        const cmd = this.#GIT_COMMANDS[this.changesOption] || this.#GIT_COMMANDS.uncommitted; //TODO: move to constructor???
        
        console.error(APP_PREFIX, `ℹ️  We will use '${cmd}' Git command.`);

        if (cmd.includes("diff")) console.log(APP_PREFIX, `['git diff --name-only' command is a default]`);

        this.changedFiles =  this.#getChangedFilesFromGit(cmd);

        if (this.changedFiles.length === 0) {
            console.log(APP_PREFIX, 'ℹ️  No files changed in the latest Git commit. Skipping coverage processing.');
            return undefined;
        }

        console.log(APP_PREFIX, `📑  GIT changed files:\n  - ${this.changedFiles.join('\n  - ')}`);        
        return this;
    }

    /**
     * Validates the coverage file path (stored in `this.coverageFilePath`).
     *
     * This method checks:
     * - That the file exists on disk.
     * - That it is a regular file (not a directory or special file).
     * - That it has a `.yml` extension to ensure it's a YAML file.
     *
     * Logs descriptive error messages for any failures.
     *
     * @returns {this|undefined} The current instance if all checks pass; otherwise, `undefined`.
     */
    validateCoverageFile() {
        // Validate the presence of the coverage filepath
        if (!fs.existsSync(this.coverageFilePath)) {
            console.log(APP_PREFIX, '❌ Coverage file not found:', this.coverageFilePath);
            return undefined;
        }

        // Ensure the given path is a file (not a directory or other type)
        const stat = fs.statSync(this.coverageFilePath);
        if (!stat.isFile()) {
            console.log(APP_PREFIX, '❌ Provided coverage path is not a file:', this.coverageFilePath);
            return undefined;
        }

        // Validate the file extension to be ".yml" to ensure it's a YAML file
        if (path.extname(this.coverageFilePath) !== ".yml") {
            console.log(APP_PREFIX, '❌ Coverage file must have a .yml extension:', this.coverageFilePath);
            return undefined;
        }

        debug(`Coverage file is OK! (path = ${this.coverageFilePath})`);

        return this;
    }

    /**
     * Parses the YAML coverage file (located at `this.coverageFilePath`) into a JavaScript object.
     *
     * - Reads the file content using UTF-8 encoding.
     * - Parses it as YAML using the `yaml` library.
     * - Stores the result in `this.parsedCoverage`.
     * - If parsing fails, logs an error and returns `undefined`.
     *
     * @returns {this|undefined} The current instance if success, or `undefined` if parsing fails.
     */
    parseCoverageFile() {
        try {
            // Read the contents of the YAML file and attempt to parse the YAML into a JavaScript object
            const rawYml = fs.readFileSync(this.coverageFilePath, 'utf8');
            this.parsedCoverage = yaml.load(rawYml) || {};

            console.log(APP_PREFIX, `✅ Coverage file parsed successfully: ${this.coverageFilePath}`);

            return this;
        }
        catch (err) {
            console.error(APP_PREFIX, '❌ Failed to parse YAML:', err.message);
            return undefined;
        }
    }

    async extractRelevantTestsFromChanges() { 
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
                        this.tests.add(id.slice(1));
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
            console.log(APP_PREFIX, 'ℹ️  No matching entries in coverage file for provided Git changes.');
            return;
        }

        debug(`Matched lines: ${matchedLines}`);

        // Get test IDs by provided additional test attributes from the server side        
        try {
            await this.#resolveTestomatioAttributeTests(this.tagLabels, 'tag-name');
            // await this._resolveAttributeSet(this.suiteIds, 'suite'); // for the future -> get list of all suite tests
        }
        catch (err) {
            console.log(APP_PREFIX, `❌ Failed to retrieve the list of Attribute tests: ${err}`);
        }

        if (this.tests.size === 0) {
            console.log(APP_PREFIX, 'ℹ️  No tests found for execution based on Git changes and coverage.');
            return;
        }

        return this.tests;
    }

    /**
     * Generates a `--grep` command-line argument for test filtering based on collected test IDs.
     *
     * - Converts the `this.tests` Set into a pipe-separated string pattern (e.g., `id1|id2|id3`).
     * - Formats it as a Mocha, Codecept, Playwright-compatible `--grep` flag.
     *
     * @returns {string} A formatted grep command string (e.g., ` --grep "(id1|id2|id3)"`). Returns an empty pattern if `this.tests` is empty.
     */
    getGrepCommand() {
        const grepPattern = [...this.tests].join('|');
        debug(`Full -grep command: --grep "(${grepPattern})"`);

        return ` --grep "(${grepPattern})"`;
    }   

    async #resolveTestomatioAttributeTests(set, type) {
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
}