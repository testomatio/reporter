"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const picocolors_1 = __importDefault(require("picocolors"));
const crypto_1 = __importDefault(require("crypto"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
const fs_1 = __importDefault(require("fs"));
const constants_js_1 = require("../constants.js");
const client_js_1 = __importDefault(require("../client.js"));
const utils_js_1 = require("../utils/utils.js");
const index_js_1 = require("../services/index.js");
const data_storage_js_1 = require("../data-storage.js");
const reportTestPromises = [];
class PlaywrightReporter {
    constructor(config = {}) {
        this.client = new client_js_1.default({ apiKey: config?.apiKey });
        this.uploads = [];
    }
    onBegin(config, suite) {
        // clean data storage
        utils_js_1.fileSystem.clearDir(constants_js_1.TESTOMAT_TMP_STORAGE_DIR);
        if (!this.client)
            return;
        this.suite = suite;
        this.config = config;
        this.client.createRun();
    }
    onTestBegin(testInfo) {
        const fullTestTitle = getTestContextName(testInfo);
        data_storage_js_1.dataStorage.setContext(fullTestTitle);
    }
    onTestEnd(test, result) {
        // test.parent.project().__projectId
        if (!this.client)
            return;
        const { title } = test;
        const { error, duration } = result;
        const suite_title = test.parent ? test.parent?.title : path_1.default.basename(test?.location?.file);
        const steps = [];
        for (const step of result.steps) {
            const appendedStep = appendStep(step);
            if (appendedStep) {
                steps.push(appendedStep);
            }
        }
        const fullTestTitle = getTestContextName(test);
        let logs = '';
        if (result.stderr.length || result.stdout.length) {
            logs = `\n\n${picocolors_1.default.bold('Logs:')}\n${picocolors_1.default.red(result.stderr.join(''))}\n${result.stdout.join('')}`;
        }
        const manuallyAttachedArtifacts = index_js_1.services.artifacts.get(fullTestTitle);
        const testMeta = index_js_1.services.keyValues.get(fullTestTitle);
        const rid = test.id || test.testId || (0, uuid_1.v4)();
        /**
         * @type {{
        * browser?: string,
        * dependencies: string[],
        * isMobile?: boolean
        * metadata: Record<string, any>,
        * name: string,
        * }}
        */
        const project = {
            browser: test.parent.project().use.defaultBrowserType,
            dependencies: test.parent.project().dependencies,
            isMobile: test.parent.project().use.isMobile,
            metadata: test.parent.project().metadata,
            name: test.parent.project().name,
        };
        const reportTestPromise = this.client.addTestRun(checkStatus(result.status), {
            rid: `${rid}-${project.name}`,
            error,
            test_id: (0, utils_js_1.getTestomatIdFromTestTitle)(`${title} ${test.tags?.join(' ')}`),
            suite_title,
            title,
            steps: steps.length ? steps : undefined,
            time: duration,
            logs,
            manuallyAttachedArtifacts,
            meta: {
                browser: project.browser,
                isMobile: project.isMobile,
                project: project.name,
                projectDependencies: project.dependencies?.length ? project.dependencies : null,
                ...testMeta,
                ...project.metadata, // metadata has any type (in playwright), but we will stringify it in client.js
            },
            file: test.location?.file,
        });
        this.uploads.push({
            rid: `${rid}-${project.name}`,
            title: test.title,
            files: result.attachments.filter(a => a.body || a.path),
            file: test.location?.file,
        });
        // remove empty uploads
        this.uploads = this.uploads.filter(anUpload => anUpload.files.length);
        reportTestPromises.push(reportTestPromise);
    }
    #getArtifactPath(artifact) {
        if (artifact.path) {
            if (path_1.default.isAbsolute(artifact.path))
                return artifact.path;
            return path_1.default.join(this.config.outputDir || this.config.projects[0].outputDir, artifact.path);
        }
        if (artifact.body) {
            let filePath = generateTmpFilepath(artifact.name);
            const extension = artifact.contentType?.split('/')[1]?.replace('jpeg', 'jpg');
            if (extension)
                filePath += `.${extension}`;
            fs_1.default.writeFileSync(filePath, artifact.body);
            return filePath;
        }
        return null;
    }
    async onEnd(result) {
        if (!this.client)
            return;
        await Promise.all(reportTestPromises);
        if (this.uploads.length) {
            if (this.client.uploader.isEnabled)
                console.log(constants_js_1.APP_PREFIX, `🎞️  Uploading ${this.uploads.length} files...`);
            const promises = [];
            // ? possible move to addTestRun (needs investigation if files are ready)
            for (const upload of this.uploads) {
                const { rid, file, title } = upload;
                const files = upload.files.map(attachment => ({
                    path: this.#getArtifactPath(attachment),
                    title,
                    type: attachment.contentType,
                }));
                if (!this.client.uploader.isEnabled) {
                    files.forEach(f => this.client.uploader.storeUploadedFile(f, this.client.runId, rid, false));
                    continue;
                }
                promises.push(this.client.addTestRun(undefined, {
                    rid,
                    title,
                    files,
                    file,
                }));
            }
            await Promise.all(promises);
        }
        await this.client.updateRunStatus(checkStatus(result.status));
    }
}
function checkStatus(status) {
    return ({
        skipped: constants_js_1.STATUS.SKIPPED,
        timedOut: constants_js_1.STATUS.FAILED,
        passed: constants_js_1.STATUS.PASSED,
    }[status] || constants_js_1.STATUS.FAILED);
}
function appendStep(step, shift = 0) {
    // nesting too deep, ignore those steps
    if (shift >= 10)
        return;
    let newCategory = step.category;
    switch (newCategory) {
        case 'test.step':
            newCategory = 'user';
            break;
        case 'hook':
            newCategory = 'hook';
            break;
        case 'attach':
            return null; // Skip steps with category 'attach'
        default:
            newCategory = 'framework';
    }
    const formattedSteps = [];
    for (const child of step.steps || []) {
        const appendedChild = appendStep(child, shift + 2);
        if (appendedChild) {
            formattedSteps.push(appendedChild);
        }
    }
    const resultStep = {
        category: newCategory,
        title: step.title,
        duration: step.duration,
    };
    if (formattedSteps.length) {
        resultStep.steps = formattedSteps.filter(s => !!s);
    }
    if (step.error !== undefined) {
        resultStep.error = step.error;
    }
    return resultStep;
}
function generateTmpFilepath(filename = '') {
    filename = filename || `tmp.${crypto_1.default.randomBytes(16).toString('hex')}`;
    const tmpdir = os_1.default.tmpdir();
    return path_1.default.join(tmpdir, filename);
}
/**
 * Returns filename + test title
 * @param {*} test - testInfo object from Playwright
 * @returns
 */
function getTestContextName(test) {
    return `${test._requireFile || ''}_${test.title}`;
}
module.exports = PlaywrightReporter;
