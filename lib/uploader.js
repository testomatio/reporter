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
const debug = (0, debug_1.default)('@testomatio/reporter:file-uploader');
class S3Uploader {
    constructor() {
        this.isEnabled = undefined;
        this.storeEnabled = true;
        this.config = undefined;
        // counters
        this.skippedUploadsCount = 0;
        this.failedUploadsCount = 0;
        this.totalUploadsCount = 0;
        this.succesfulUploads = {};
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
            debug(`Upload is disabled because S3_BUCKET is not set`);
        this.isEnabled = !!(S3_BUCKET && !TESTOMATIO_DISABLE_ARTIFACTS);
        if (this.isEnabled)
            debug('S3 uploader is enabled');
        debug(this.getMaskedConfig());
        return this.isEnabled;
    }
    enableLogStorage() {
        this.storeEnabled = true;
    }
    disbleLogStorage() {
        this.storeEnabled = false;
    }
    async #uploadToS3(Body, Key) {
        const { S3_BUCKET, TESTOMATIO_PRIVATE_ARTIFACTS } = this.getConfig();
        const ACL = TESTOMATIO_PRIVATE_ARTIFACTS ? 'private' : 'public-read';
        if (!S3_BUCKET || !Body) {
            console.log(constants_js_1.APP_PREFIX, picocolors_1.default.bold(picocolors_1.default.red(`Failed uploading '${Key}'. Please check S3 credentials`)), this.getMaskedConfig());
            return;
        }
        debug('Uploading to S3:', Key);
        const s3 = new client_s3_1.S3(this.#getS3Config());
        try {
            const upload = new lib_storage_1.Upload({
                client: s3,
                params: {
                    Bucket: S3_BUCKET,
                    Key,
                    Body,
                    ACL,
                },
            });
            const link = await this.getS3LocationLink(upload);
            this.totalUploadsCount++;
            this.succesfulUploads[Key] = link;
            return link;
        }
        catch (e) {
            this.failedUploadsCount++;
            debug('S3 uploading error:', e);
            console.log(constants_js_1.APP_PREFIX, 'Upload failed:', e.message, this.getMaskedConfig());
        }
    }
    /**
      * Returns an array of uploaded files list
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
     *
     * @param {*} filePath
     * @param {*} pathInS3 contains runId, rid and filename
     * @returns
     */
    async uploadFileByPath(filePath, pathInS3) {
        const [runId, rid] = pathInS3;
        if (!filePath)
            return;
        if (!this.isEnabled) {
            this.storeUploadedFile(filePath, runId, rid, false);
            this.skippedUploadsCount++;
            return;
        }
        const { S3_BUCKET, TESTOMATIO_ARTIFACT_MAX_SIZE_MB } = this.getConfig();
        debug('Started upload', filePath, 'to', S3_BUCKET);
        const isFileExist = await this.checkArtifactExistsInFileSystem(filePath, 20, 500);
        if (!isFileExist) {
            console.error(picocolors_1.default.yellow(`Artifacts file ${filePath} does not exist. Skipping...`));
            return;
        }
        const fileSize = fs_1.default.statSync(filePath).size;
        const fileSizeInMb = fileSize / (1024 * 1024);
        if (TESTOMATIO_ARTIFACT_MAX_SIZE_MB && fileSizeInMb > parseInt(TESTOMATIO_ARTIFACT_MAX_SIZE_MB, 10)) {
            this.skippedUploadsCount++;
            console.error(picocolors_1.default.yellow(`Artifacts file ${filePath} exceeds the maximum allowed size. Skipping...`));
            return;
        }
        debug('File:', filePath, 'exists, size:', fileSizeInMb.toFixed(2), 'MB');
        const fileStream = fs_1.default.createReadStream(filePath);
        const Key = pathInS3.join('/');
        const link = await this.#uploadToS3(fileStream, Key);
        this.storeUploadedFile(filePath, runId, rid, !!link);
        return link;
    }
    async uploadFileAsBuffer(buffer, pathInS3) {
        if (!this.isEnabled)
            return;
        let Key = pathInS3.join('/');
        const ext = this.#getFileExtBase64(buffer);
        if (ext) {
            Key = `${Key}.${ext}`;
        }
        return this.#uploadToS3(buffer, Key);
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
        let s3Location = response?.Location;
        if (!s3Location) {
            s3Location = out?.singleUploadResult?.Location;
            debug('Uploaded singleUploadResult.Location', s3Location);
            if (!s3Location) {
                throw new Error("Problems getting the S3 artifact's link. Please check S3 permissions!");
            }
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
                s3ForcePathStyle: S3_FORCE_PATH_STYLE,
            },
        };
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
