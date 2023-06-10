const debug = require('debug')('@testomatio/reporter:file-uploader');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { randomUUID } = require('crypto');
const { APP_PREFIX } = require('../constants');

class Uploader {
    constructor(opts) {
        this.runId = opts.runId;
        this.buffer = opts.buffer || undefined;
        this.enabled = false;
        this.prefix = APP_PREFIX;

        if (opts.filepath && typeof opts.filepath === 'object') {
            this.contentType = opts.filepath.type
            this.filepath = opts.filepath.path;
            this.Key = opts.filepath.name;
            this.fileKey = `${this.runId}/${randomUUID()}-${this.Key || path.basename(this.filepath)}`;
        }
        if (opts.filename) {
            this.filename = opts.filename;
            this.bufferKey = `${this.runId}/${this.filename}${this.fileExtBase64}`;
        }
    }
    /**
     * Retrieves the file extension based on the base64-encoded buffer.
     * @returns {string|Buffer} The file extension corresponding to 
     * the base64-encoded buffer if the buffer exists, 
     * or the buffer itself if it is falsy.
     */

    get fileExtBase64() {

        return (this.buffer)
            ? this.fileExt64(this.buffer.toString('base64'))
            : this.buffer
    }
    /**
     * Retrieves the file extension based on the given string.
     * @param {string} str - The input string.
     * @returns {string} The file extension corresponding to the input 
     * string, or an empty string if no matching extension is found.
     */

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
    /**
     * Retrieves the contents of a file based on its filepath.
     * @returns {Buffer|undefined} The contents of the file as 
     * a Buffer if the file exists, or undefined if the file does not exist.
     */

    get fileByPath() {
        if (fs.existsSync(this.filepath)) {
            return fs.readFileSync(this.filepath);
        }
        console.error(chalk.yellow(`Artifacts file ${this.filepath} does not exist. Skipping...`));
        return;
    }
    /**
     * Logs a message to disable artifact uploads by setting 
     * the TESTOMATIO_DISABLE_ARTIFACTS environment variable.
     */

    disableArtifactsUploadWarning() {
        console.log(this.prefix, `To ${chalk.bold('disable')} artifact uploads set: TESTOMATIO_DISABLE_ARTIFACTS=1`);
    }
    /**
     * Logs a warning message related to access to 
     * storage for uploading artifacts.
     */

    accesseToStorageWarning() {
        const { TESTOMATIO_PRIVATE_ARTIFACTS } = process.env;

        console.log(this.prefix, '---------------');

        this.disableArtifactsUploadWarning();

        if (!TESTOMATIO_PRIVATE_ARTIFACTS) {
            console.log(this.prefix, `To enable ${chalk.bold('PRIVATE')} uploads set: TESTOMATIO_PRIVATE_ARTIFACTS=1`);
        }
        else {
            console.log(
                this.prefix,
                `To enable ${chalk.bold('PUBLIC')} uploads remove TESTOMATIO_PRIVATE_ARTIFACTS env variable`,
            );
        }
        console.log(this.prefix, '---------------');
    }
    /**
     * Logs an error message when an error occurs while uploading artifacts to a specific bucket.
     * @param {Error} e - The error object representing the error that occurred.
     */

    uploadingBucketError(e) {
        console.error(chalk.red(`Error occurred while uploading artifacts to the bucket.`), e);
    }
    /**
     * Prepares the environment by retrieving specific environment variables.
     * @param {string[]} keys - An array of environment variable keys to retrieve.
     * @returns {Object} An object containing the retrieved environment variables, 
     * where the keys are the provided environment variable keys and the 
     * values are the corresponding values from the process environment.
     */

    static envPreparation(keys) {
        return keys.reduce((acc, key) => {
            acc[key] = process.env[key];
            return acc;
        }, {})
    }
    /**
     * Checks if S3 artifacts are enabled based on specific conditions.
     * @returns {boolean} Returns true if S3 artifacts are enabled, false otherwise.
     */

    static isS3ArtifactsEnabled() {
        const enabled = !!(process.env.S3_BUCKET && !process.env.TESTOMATIO_DISABLE_ARTIFACTS);
        debug(`Uploading to S3 is ${ enabled ? 'enabled' : 'disabled' }`);

        return enabled;
    }
    /**
     * Checks if Azure artifacts are enabled based on specific conditions.
     * @returns {boolean} Returns true if Azure artifacts are enabled, false otherwise.
     */

    static isAzureArtifactsEnabled() {
        const enabled = !!(process.env.AZURE_ACCOUNT_KEY 
            && process.env.AZURE_CONTAINER_NAME 
            && !process.env.TESTOMATIO_DISABLE_ARTIFACTS);

        debug(`Uploading to AZURE is ${enabled ? 'enabled' : 'disabled'}`);

        return enabled;
    }
}

module.exports = Uploader;