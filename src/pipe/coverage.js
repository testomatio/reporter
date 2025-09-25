import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { execSync } from 'child_process';
import { Gaxios } from 'gaxios';
import { minimatch } from 'minimatch';
import pc from 'picocolors';
import { APP_PREFIX, AXIOS_TIMEOUT, REPORTER_REQUEST_RETRIES } from '../constants.js';
import { parseFilterParams, generateFilterRequestParams } from '../utils/pipe_utils.js';
import { config } from '../config.js';
import createDebugMessages from 'debug';

const debug = createDebugMessages('@testomatio/reporter:pipe:csv');

// TODO: Add unit tests like for testomatio_pipe_tests !!! after deeper testing

// Example of use 'coverage:file=coverage/coverage.yml,diff=master' cmd:
// | Option | Git command | Notes |
// | --- | --- | --- |
// | --filter "coverage:file=coverage/coverage.yml,diff=new-branch" | ✅ git diff new-branch --name-only | - |
// | --filter "coverage:file=diff=master,coverage.yml" | ✅ git diff master --name-only | - |
// | --filter "coverage:file=coverage/coverage.yml" | ✅ git diff master --name-only | default branch = "master" |
// | --filter "coverage:file=coverage.yml,dif=noexist-branch" | ❌ Git command failed ...| - |
// | --filter "coverage:file=no-exist-coverage.yml" | ❌ Coverage file not found: <>filename>.yml | - |
// | --filter "coverage:filepath=coverage.yml" | 🚫 Missing required parameter: "file"... | - |
// | --filter "coverage:diff=my-branch" | 🚫 Missing required parameter: "file"...| - |

//maybe GitChanges or GitCoverage
class CoveragePipe { // or Changes for the future???
    #GIT = {
        default_branch: 'master',
        diff_command: 'git diff',
        only_file_opt: '--name-only',
        uncommitted_marker: 'uncommitted',
    };

    constructor(params, store) {
        this.id = 'coverage'; // as future updates -> find by id in clien.js
        this.store = store || {};
        this.isEnabled = false;

        // Client config section
        this.formattedDate = new Date().toISOString().replace(/T/, '-').replace(/:/g, '-').split('.')[0];
        this.title = process.env.TESTOMATIO_TITLE || `Testomatio Coverage Test Execution - ${this.formattedDate}`;
        this.apiKey = process.env['INPUT_TESTOMATIO-KEY'] || config.TESTOMATIO;

        this.coverageFilePath = process.env.COVERAGE_FILEPATH || undefined;
        // TODO: this.gitCommitOption = params.changes || this.#GIT.uncommitted_marker; // Default = "uncommitted" if not provided
        
        if (!process.env.COVERAGE_BRANCH) {
            console.log(
                APP_PREFIX,
                `🟡 No "diff" branch provided. That's why we use default branch = "${this.#GIT.default_branch}".\n` +
                '👉 You can set it via --filter "coverage:file=coverage.yml,diff=your-branch"'
            );
        }

        this.branch = process.env.COVERAGE_BRANCH ? process.env.COVERAGE_BRANCH : this.#GIT.default_branch;

        debug('Coverage Pipe: ', 'Git Branch - ', this.branch, ', Coverage filepath - ', this.coverageFilePath);
        
        if (!this.coverageFilePath) return;
        
        this.url = params.testomatioUrl || process.env.TESTOMATIO_URL || 'https://app.testomat.io';
        const proxyUrl = process.env.HTTP_PROXY || process.env.HTTPS_PROXY;
        const proxy = proxyUrl ? new URL(proxyUrl) : null;

        // In case if we have all needed data
        this.isEnabled = true;
        // Create a new instance of gaxios with a custom config
        this.client = new Gaxios({
            baseURL: `${this.url.trim()}`,
            timeout: AXIOS_TIMEOUT,
            proxy: proxy ? proxy.toString() : undefined,
            retry: true,
            retryConfig: {
            retry: REPORTER_REQUEST_RETRIES.retriesPerRequest,
            retryDelay: REPORTER_REQUEST_RETRIES.retryTimeout,
            httpMethodsToRetry: ['GET','PUT','HEAD','OPTIONS','DELETE','POST'],
            shouldRetry: (error) => {
                if (!error.response) return false;
                switch (error.response?.status) {
                case 400: // Bad request (probably wrong API key)
                case 404: // Test not matched
                case 429: // Rate limit exceeded
                case 500: // Internal server error
                    return false;
                default:
                    break;
                }
                return error.response?.status >= 401; // Retry on 401+ and 5xx
            }
            }
        });

        this.parsedCoverage = {};
        this.changedFiles = [];
        this.matchedLines = new Set();        
        this.tests = new Set();
        this.suiteIds = new Set();
        this.tagLabels = new Set();

        this.results = [];

        debug(`Coverage Pipe: is Enabled = ${this.isEnabled}`);
    }

    async prepareRun(params) {
        if (!this.isEnabled) return [];

        // Step 1: Validate coverage file path & Git changes & Coverage parsing
        if (!this.getGitChangedFiles()?.validateCoverageFile()?.parseCoverageFile()) return;

        // Step 2: Extract all available tests and compare with coverage file
        const lines = await this.extractRelevantTestsFromChanges();

        if (lines.size === 0) {
            console.log(APP_PREFIX, 'ℹ️  No matching entries in coverage file for provided Git changes.');
            return;
        }

        if (this.tests.size === 0) {
            console.log(APP_PREFIX, 'ℹ️  No tests found for execution based on Git changes.');            
            return;
        }

        // Step 2: Handle tag labels tests from the server
        if (this.tagLabels && this.tagLabels.size > 0) {
            for (const tag of this.tagLabels) {
                const tests = await this.#getTestomatioTestsByParam(`tag-name=${tag}`);

                if (!tests) return;
                
                tests.forEach(testId => this.tests.add(testId));
            }
        }

        console.log(APP_PREFIX, `✅ We found ${this.tests.size === 1 ? 'one test' : `${this.tests.size} tests`} in Testomat.io side.`);
        console.log(pc.green(`📝 Retrieving a list of all modified tests from files is complete! Start running tests...`));        
        
        return this.tests;
    }

    addTest(test) {} // WIP*???

    async createRun() {}

    updateRun() {}

    async finishRun(runParams) {}

    toString() {
        return 'Coverage Reporter';
    }

    /**
     * Fetches a list of tests from the Testomat.io server based on a given filter parameter.
     *
     * The method parses the provided filter (`type=id`), builds the appropriate request parameters,
     * sends a GET request to the Testomat.io `/api/test_grep` endpoint, and returns the matching tests.
     *
     * If the filter is invalid, no query is generated, or the server responds with no matching tests,
     * it logs relevant information and returns `undefined`.
     *
     * @async function
     * @param {string} param - The filter string in the format like `tag-name=smoke`.
     * @returns {Promise<Array<Object>|undefined>} Resolves to an array of test objects if found, otherwise `undefined`.
     */
    async #getTestomatioTestsByParam(param) {
        const { type, id } = parseFilterParams(param);

        // Get extra tests from the server
        try {
            const q = generateFilterRequestParams({
                type,
                id,
                apiKey: this.apiKey.trim(),
            });

            if (!q) {
                return;
              }

            const resp = await this.client.request({
                method: 'GET',
                url: '/api/test_grep',
                ...q,
            });

            if (!Array.isArray(resp.data?.tests) && resp.data?.tests?.length === 0) {
                console.log(APP_PREFIX, `🔍 No test by ${type}=${id} were found on the Testomat.io server side!`);
                return undefined;
            }

            return resp.data.tests;
        } 
        catch (err) {
            console.error(APP_PREFIX, `🚩 Error getting available tests from the Testomat.io by "test_grep" option: ${err}`);
            return undefined;
        }
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
            } 
            else {
                throw new Error(`❌ Git command failed ("${cmd}"):\n`, errorMessage);
            }
    
            return [];
        }
    }

    /**
     * Builds a Git command string to list file changes between the current state 
     * and a specified Git branch using `git diff --name-only`.
     * 
     * Private pipe function
     * @throws {Error} Throws an error if `this.branch` is not defined.
     * @returns {string} A Git command string, e.g., 'git diff <branch> --name-only'.
     */
    #buildGitCommand() {
        if (!this.branch) throw new Error(`❌ Invalid changes option for setted branch!`);
        
        return `git diff ${this.branch} --name-only`; // Example: 'git diff <master> --name-only' 
    }

    /**
     * Retrieves the list of files changed in the current Git working directory 
     * compared to a specified branch.
     *
     * This method builds a Git diff command and attempts to retrieve the changed 
     * files using that command. It logs helpful information and errors during the process.
     *
     * If no changed files are found, or an error occurs at any stage, the method logs 
     * the issue and returns `undefined`.
     *
     * @returns {this | undefined} Returns the current instance (`this`) if changed files are found; otherwise, returns `undefined`.
     */
    getGitChangedFiles() {
        let cmd;

        try {
            cmd = this.#buildGitCommand();
        } 
        catch (err) {
            console.error(APP_PREFIX, err.message);
            return undefined;
        }
        
        console.error(APP_PREFIX, `ℹ️  We will use '${cmd}' Git command.`);

        try {
            this.changedFiles =  this.#getChangedFilesFromGit(cmd);

            if (this.changedFiles.length === 0) {
                console.log(APP_PREFIX, 'ℹ️  No files changed in the latest Git commit. Skipping coverage processing.');
                return undefined;
            }
        }
        catch (err) {
            console.error(APP_PREFIX, err.message);
            console.error(APP_PREFIX, "🔍 Pls, check this Git command manually to understand the original problem.");
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
     * @returns {this | undefined} "true" in case if coverage file is valid and we can keep going; otherwise, `undefined`.
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

        debug('Coverage file validation is OK!');

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
     * @returns {this | undefined} The current parsed coverage yml file change lines, or "undefined" if parsing fails.
     */
    parseCoverageFile() {
        try {
            // Read the contents of the YAML file and attempt to parse the YAML into a JavaScript object
            const rawYml = fs.readFileSync(this.coverageFilePath, 'utf8');
            this.parsedCoverage = yaml.load(rawYml) || {};

            debug(`Coverage filepath = ${this.coverageFilePath})`);
            console.log(APP_PREFIX, `✅ Coverage file parsed successfully: ${this.coverageFilePath}`);

            return this;
        }
        catch (err) {
            console.error(APP_PREFIX, '❌ Failed to parse YAML:', err.message);
            return undefined;
        }
    }

    /**
     * Extracts relevant test identifiers from changed files based on coverage mapping.
     *
     * Iterates over changed files and matches them against patterns in the parsed coverage data.
     * For each match, it extracts test IDs or tags and stores them in corresponding sets:
     * - Test IDs (starting with '@T' or '@S') are stored in `this.tests`
     * - Tag labels (starting with 'tag:') are stored in `this.tagLabels`
     * - Matched file paths are stored in `this.matchedLines`
     *
     * @returns {Promise <Set<string>>} A set of file paths that matched coverage patterns (`this.matchedLines`).
     */
    async extractRelevantTestsFromChanges() {         
        for (const changedFile of this.changedFiles) {
            for (const [pattern, ids] of Object.entries(this.parsedCoverage)) {
              if (minimatch(changedFile, pattern)) {
                this.matchedLines.add(changedFile);
      
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

        debug(`Matched lines: ${this.matchedLines}`);

        return this.matchedLines;
    }
}

export default CoveragePipe;