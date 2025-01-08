"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.S3Uploader = void 0;
const debug_1 = __importDefault(require("debug"));
const client_s3_1 = require("@aws-sdk/client-s3");
const lib_storage_1 = require("@aws-sdk/lib-storage");
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const promise_retry_1 = __importDefault(require("promise-retry"));
const picocolors_1 = __importDefault(require("picocolors"));
const constants_js_1 = require("./constants.js");
const filesize_1 = require("filesize");
const debug = (0, debug_1.default)('@testomatio/reporter:file-uploader');
class S3Uploader {
    constructor() {
        this.isEnabled = undefined;
        this.storeEnabled = true;
        this.config = undefined;
        /**
         * @type {{path: string, size: number}[]}
         */
        this.skippedUploads = [];
        this.failedUploads = [];
        /**
         * @type {{path: string, size: number, link: string}[]}
         */
        this.successfulUploads = [];
        this.configKeys = [
            'S3_ENDPOINT',
            'S3_REGION',
            'S3_BUCKET',
            'S3_ACCESS_KEY_ID',
            'S3_SECRET_ACCESS_KEY',
            'S3_SESSION_TOKEN',
            'S3_FORCE_PATH_STYLE',
            'TESTOMATIO_DISABLE_ARTIFACTS',
            'TESTOMATIO_PRIVATE_ARTIFACTS',
            'TESTOMATIO_ARTIFACT_MAX_SIZE_MB',
        ];
    }
    resetConfig() {
        this.config = undefined;
        this.isEnabled = undefined;
    }
    /**
     *
     * @returns {Record<string, string>}
     */
    getConfig() {
        if (this.config)
            return this.config;
        this.config = this.configKeys.reduce((acc, key) => {
            acc[key] = process.env[key];
            return acc;
        }, {});
        return this.config;
    }
    getMaskedConfig() {
        return Object.fromEntries(Object.entries(this.getConfig()).map(([key, value]) => [
            key,
            key === 'S3_SECRET_ACCESS_KEY' || key === 'S3_ACCESS_KEY_ID' ? '***' : value,
        ]));
    }
    checkEnabled() {
        if (this.isEnabled !== undefined)
            return this.isEnabled;
        const { S3_BUCKET, TESTOMATIO_DISABLE_ARTIFACTS } = this.getConfig();
        if (!S3_BUCKET)
            debug(`Artifacts uploading is disabled because S3_BUCKET is not set`);
        this.isEnabled = !!(S3_BUCKET && !TESTOMATIO_DISABLE_ARTIFACTS);
        if (this.isEnabled)
            debug('S3 uploader is enabled');
        debug(this.getMaskedConfig());
        return this.isEnabled;
    }
    enableLogStorage() {
        this.storeEnabled = true;
    }
    disableLogStorage() {
        this.storeEnabled = false;
    }
    /**
     *
     * @param {*} Body
     * @param {*} Key
     * @param {{path: string, size?: number}} file
     * @returns
     */
    async #uploadToS3(Body, Key, file) {
        const { S3_BUCKET, TESTOMATIO_PRIVATE_ARTIFACTS } = this.getConfig();
        const ACL = TESTOMATIO_PRIVATE_ARTIFACTS ? 'private' : 'public-read';
        if (!S3_BUCKET || !Body) {
            console.log(constants_js_1.APP_PREFIX, picocolors_1.default.bold(picocolors_1.default.red(`Failed uploading '${Key}'. Please check S3 credentials`)), this.getMaskedConfig());
            return;
        }
        debug('Uploading to S3:', Key);
        const s3Config = this.#getS3Config();
        const s3 = new client_s3_1.S3(s3Config);
        const params = {
            Bucket: S3_BUCKET,
            Key,
            Body,
        };
        // disable ACL for I AM roles
        if (!s3Config.credentials.sessionToken) {
            params.ACL = ACL;
        }
        try {
            const upload = new lib_storage_1.Upload({ client: s3, params });
            const link = await this.getS3LocationLink(upload);
            this.successfulUploads.push({ path: file.path, size: file.size, link });
            debug(`📤 Uploaded artifact. File: ${file.path}, size: ${(0, filesize_1.filesize)(file.size)}, link: ${link}`);
            return link;
        }
        catch (e) {
            this.failedUploads.push({ path: file.path, size: file.size });
            debug('S3 uploading error:', e);
            console.log(constants_js_1.APP_PREFIX, 'Upload failed:', e.message, '\nConfig:\n', this.getMaskedConfig());
        }
    }
    /**
     * Returns an array of uploaded files
     *
     * @returns {{rid: string, file: string, uploaded: boolean}[]}
     */
    readUploadedFiles(runId) {
        const tempFilePath = this.#getFilePathWithUploadsList(runId);
        debug('Reading file', tempFilePath);
        if (!fs_1.default.existsSync(tempFilePath)) {
            debug('File not found:', tempFilePath);
            return [];
        }
        const stats = fs_1.default.statSync(tempFilePath);
        debug('Artifacts file stats:', +stats.mtime);
        debug('Current time:', +new Date());
        const diff = +new Date() - +stats.mtime;
        debug('Diff:', diff);
        const diffHours = diff / 1000 / 60 / 60;
        debug('Diff hours:', diffHours);
        if (diffHours > 3) {
            console.log(constants_js_1.APP_PREFIX, "Artifacts file is too old, can't process artifacts. Please re-run the tests.");
            return [];
        }
        const data = fs_1.default.readFileSync(tempFilePath, 'utf8');
        debug('Artifacts file contents:', data);
        const lines = data.split('\n').filter(Boolean);
        return lines.map(line => JSON.parse(line));
    }
    #getFilePathWithUploadsList(runId) {
        const tempFilePath = path_1.default.join(os_1.default.tmpdir(), `testomatio.run.${runId}.json`);
        if (!fs_1.default.existsSync(tempFilePath)) {
            debug('Creating artifacts file:', tempFilePath);
            fs_1.default.writeFileSync(tempFilePath, '');
        }
        return tempFilePath;
    }
    storeUploadedFile(filePath, runId, rid, uploaded = false) {
        if (!this.storeEnabled)
            return;
        if (!filePath || !runId || !rid)
            return;
        const tempFilePath = this.#getFilePathWithUploadsList(runId);
        if (typeof filePath === 'object') {
            filePath = filePath.path;
        }
        if (typeof filePath === 'string' && !path_1.default.isAbsolute(filePath)) {
            filePath = path_1.default.join(process.cwd(), filePath);
        }
        const data = { rid, file: filePath, uploaded };
        const jsonLine = `${JSON.stringify(data)}\n`;
        fs_1.default.appendFileSync(tempFilePath, jsonLine);
    }
    /**
     * @param {*} filePath
     * @param {*} pathInS3 contains runId, rid and filename
     * @returns
     */
    async uploadFileByPath(filePath, pathInS3) {
        // sometimes artifacts uploading started before createRun function completion
        this.isEnabled = this.isEnabled ?? this.checkEnabled();
        const [runId, rid] = pathInS3;
        if (!filePath)
            return;
        let fileSize = null;
        let fileSizeInMb = null;
        try {
            // file may not exist
            fileSize = fs_1.default.statSync(filePath).size;
            fileSizeInMb = Number((fileSize / (1024 * 1024)).toFixed(2));
        }
        catch (e) {
            debug(`File ${filePath} does not exist`);
        }
        if (!this.isEnabled) {
            this.storeUploadedFile(filePath, runId, rid, false);
            this.skippedUploads.push({ path: filePath, size: fileSize });
            return;
        }
        const { S3_BUCKET, TESTOMATIO_ARTIFACT_MAX_SIZE_MB } = this.getConfig();
        debug('Started upload', filePath, 'to', S3_BUCKET);
        const isFileExist = await this.checkArtifactExistsInFileSystem(filePath, 20, 500);
        if (!isFileExist) {
            console.error(picocolors_1.default.yellow(`Artifacts file ${filePath} does not exist. Skipping...`));
            return;
        }
        // skipping artifact only if: 1. storing to file is enabled, 2. max size is set and 3. file size exceeds the limit
        if (this.storeEnabled &&
            TESTOMATIO_ARTIFACT_MAX_SIZE_MB &&
            fileSizeInMb > parseFloat(TESTOMATIO_ARTIFACT_MAX_SIZE_MB)) {
            const skippedArtifact = { path: filePath, size: fileSize };
            this.storeUploadedFile(filePath, runId, rid, false);
            this.skippedUploads.push(skippedArtifact);
            debug(picocolors_1.default.yellow(`Artifacts file ${JSON.stringify(skippedArtifact)} exceeds the maximum allowed size. Skipping.`));
            return;
        }
        debug('File:', filePath, 'exists, size:', (0, filesize_1.filesize)(fileSize));
        const fileStream = fs_1.default.createReadStream(filePath);
        const Key = pathInS3.join('/');
        const link = await this.#uploadToS3(fileStream, Key, { path: filePath, size: fileSize });
        this.storeUploadedFile(filePath, runId, rid, !!link);
        return link;
    }
    /**
     * @param {Buffer} buffer
     * @param {string[]} pathInS3
     * @returns
     */
    async uploadFileAsBuffer(buffer, pathInS3) {
        if (!this.isEnabled)
            return;
        let Key = pathInS3.join('/');
        const ext = this.#getFileExtBase64(buffer);
        if (ext) {
            Key = `${Key}.${ext}`;
        }
        return this.#uploadToS3(buffer, Key, { path: Key });
    }
    async checkArtifactExistsInFileSystem(filePath, attempts = 5, intervalMs = 500) {
        return (0, promise_retry_1.default)(async (retry, number) => {
            try {
                fs_1.default.accessSync(filePath);
                return true;
            }
            catch (err) {
                if (number === attempts) {
                    return false;
                }
                debug(`File not found, retrying (attempt ${number}/${attempts})`);
                await new Promise(resolve => {
                    setTimeout(resolve, intervalMs);
                });
                retry(err);
            }
        }, {
            retries: attempts,
            minTimeout: intervalMs,
            maxTimeout: intervalMs,
        });
    }
    async getS3LocationLink(out) {
        const response = await out.done();
        let s3Location = response?.Location?.trim();
        if (!s3Location) {
            s3Location = out?.singleUploadResult?.Location;
            debug('Uploaded singleUploadResult.Location', s3Location);
            if (!s3Location) {
                throw new Error("Problems getting the S3 artifact's link. Please check S3 permissions!");
            }
        }
        // Normalize the URL
        if (!s3Location.startsWith('http')) {
            s3Location = `https://${s3Location}`;
        }
        return s3Location;
    }
    #getFileExtBase64(str) {
        const type = str.charAt(0);
        return ({
            '/': 'jpg',
            i: 'png',
            R: 'gif',
            U: 'webp',
        }[type] || '');
    }
    #getS3Config() {
        const { S3_REGION, S3_SESSION_TOKEN, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_FORCE_PATH_STYLE, S3_ENDPOINT } = this.getConfig();
        const cfg = {
            region: S3_REGION,
            credentials: {
                accessKeyId: S3_ACCESS_KEY_ID,
                secretAccessKey: S3_SECRET_ACCESS_KEY,
            },
        };
        if (S3_FORCE_PATH_STYLE) {
            cfg.forcePathStyle = !['false', '0'].includes(String(S3_FORCE_PATH_STYLE || '').toLowerCase());
        }
        if (S3_SESSION_TOKEN) {
            cfg.credentials.sessionToken = S3_SESSION_TOKEN;
        }
        if (S3_ENDPOINT) {
            cfg.endpoint = S3_ENDPOINT;
        }
        return cfg;
    }
}
exports.S3Uploader = S3Uploader;

module.exports.S3Uploader = S3Uploader;
