const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { randomUUID } = require('crypto');
const { APP_PREFIX } = require('../constants');

class Uploader {

    constructor(opts) {
        this.filepath = opts.filepath;
        this.filename = opts.filename;
        this.runId = opts.runId;
        this.buffer = opts.buffer || undefined;

        this.enabled = false;

        if (typeof this.filepath === 'object') {
            this.contentType = this.filepath.type;
            this.filePath = this.filepath.path;
            this.Key = this.filepath.name;

            this.bufferKey = `${this.runId}/${this.filename}${this.fileExtBase64}`;
            this.fileKey = `${this.runId}/${randomUUID()}-${this.Key || path.basename(this.filepath)}`;
        }
    }

    get fileExtBase64() {

        return (this.buffer)
            ? this.fileExt64(this.buffer.toString('base64'))
            : this.buffer
    }

    fileExt64(str) {
        const type = str.charAt(0);

        return (
            {
                '/': '.jpg',
                i: '.png',
                R: '.gif',
                U: '.webp',
            }[type] || ''
        );
    }

    unsuccessfullBufferUploadMsg() {
        if (this.bufferKey) {
            console.log(APP_PREFIX, chalk.bold.red(`Failed uploading '${this.bufferKey}'. Please check you STORAGE credentials!`));
        }
    }

    get fileByPath() {
        if (fs.existsSync(this.filepath)) {
            return fs.readFileSync(this.filepath);
        }
        else {
            console.error(chalk.yellow(`Artifacts file ${this.filePath} does not exist. Skipping...`));
            return;
        }
    }

    disableArtifactsUploadWarning() {
        console.log(APP_PREFIX, `To ${chalk.bold('disable')} artifact uploads set: TESTOMATIO_DISABLE_ARTIFACTS=1`);
    }

    accesseToStorageWarning(privateKey) {
        console.log(APP_PREFIX, '---------------');

        if (!privateKey) {
            console.log(APP_PREFIX, `To enable ${chalk.bold('PRIVATE')} uploads set: TESTOMATIO_PRIVATE_ARTIFACTS=1`);
        } else {
            console.log(
                APP_PREFIX,
                `To enable ${chalk.bold('PUBLIC')} uploads remove TESTOMATIO_PRIVATE_ARTIFACTS env variable`,
            );
        }
        console.log(APP_PREFIX, '---------------');
    }

    uploadingBucketError(bucketName, e) {
        console.error(chalk.red(`Error occurred while uploading artifacts to the ${bucketName} bucket.`), e);
    }

    static envPreparation(keys) {
        return keys.reduce((acc, key) => {
            acc[key] = process.env[key];
            return acc;
        }, {})
    }
}

module.exports = Uploader;