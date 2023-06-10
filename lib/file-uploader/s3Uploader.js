const debug = require('debug')('@testomatio/reporter:file-uploader');
const { S3 } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const chalk = require('chalk');

const Uploader = require("./uploader");
const { UPLOAD_S3_KEYS } = require('../constants');

class S3Uploader extends Uploader {
    constructor(opts) {
        super(opts);
        this.s3Keys = UPLOAD_S3_KEYS;
        this.s3Config = Uploader.envPreparation(this.s3Keys);

        if (Object.keys(this.s3Config).length > 1) {
            const { S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY,
                S3_FORCE_PATH_STYLE, S3_ENDPOINT } = this.s3Config

            this.s3Access = {
                region: S3_REGION,
                credentials: {
                    accessKeyId: S3_ACCESS_KEY_ID,
                    secretAccessKey: S3_SECRET_ACCESS_KEY,
                    s3ForcePathStyle: S3_FORCE_PATH_STYLE || false,
                }
            }

            if (S3_ENDPOINT) {
                this.s3Access.endpoint = S3_ENDPOINT;
            }
        }
    }

    wrongAccesseWarning() {
        const {
            S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_ENDPOINT, TESTOMATIO_PRIVATE_ARTIFACTS, S3_BUCKET
        } = this.s3Config;

        console.log(this.prefix, '---------------');

        console.log(this.prefix, chalk.bold.red(`Failed uploading '${this.fileKey}'. Please check S3 credentials`), {
            accessKeyId: S3_ACCESS_KEY_ID,
            secretAccessKey: S3_SECRET_ACCESS_KEY ? '**** (hidden) ***' : '(empty)',
            region: S3_REGION,
            bucket: S3_BUCKET,
            acl: (TESTOMATIO_PRIVATE_ARTIFACTS ? 'private' : 'public-read'),
            endpoint: S3_ENDPOINT
        });

        console.log(this.prefix, '---------------');
    }
    /**
     * Sends a file to an S3 bucket using the provided parameters.
     * @param {Object} params - The parameters required for file sending.
     * @param {string} params.Bucket - The name of the S3 bucket.
     * @param {Buffer | undefined} params.file - The file to be sent.
     * @param {string} params.ContentType - The content type of the file.
     * @param {string} params.Key - The key to be assigned to the file in the S3 bucket.
     * @param {string} params.ACL - The access control level for the file in the S3 bucket.
     * @param {Buffer} params.buffer - The buffer containing the file data.
     * @returns {Promise<string>} A promise that resolves to the location link of the uploaded file.
     * @throws {Error} If required parameters (Bucket, file, ContentType) or (Bucket, buffer, Key) are not provided.
     */

    async fileSending(params) {
        let sendingPrms;

        const { Bucket, file, ContentType, Key, ACL, buffer } = params

        if (Bucket && file && ContentType) {
            sendingPrms = {
                Bucket,
                Key,
                Body: file,
                ContentType,
                ACL
            }
        }

        if (Bucket && buffer && Key) {
            sendingPrms = {
                Bucket,
                Key,
                Body: buffer,
                ACL
            }
        }     

        const s3 = new S3(this.s3Access);

        try {
            const out = new Upload({
                client: s3,
                params: sendingPrms
            });

            await out.done();
            // After successfully sending - get loation link
            debug('Uploaded ', out.singleUploadResult.Location)

            return out.singleUploadResult.Location;
        }
        catch (e) {
            debug("S3 file sending proble - ", e);
            // additional incorrect S3 config message
            this.wrongAccesseWarning();
            // additional accesse to s3 worning
            this.accesseToStorageWarning();
        }
    }
    /**
     * Uploads a file to an S3 bucket using the specified parameters (based on the file params).
     * @returns {Promise<string>} A promise that resolves to the location link of the uploaded file.
     * @throws {Error} If there is an error during the file sending process.
     */

    async uploadFileToBucket() {
        const ACL = this.s3Config.TESTOMATIO_PRIVATE_ARTIFACTS ? 'private' : 'public-read';

        return this.fileSending({
            Bucket: this.s3Config.S3_BUCKET,
            Key: this.fileKey,
            file: this.fileByPath,
            ContentType: this.contentType,
            ACL,
            buffer: undefined
        })
    }
    /**
     * Uploads a file to an S3 bucket using the specified parameters (based on the buffer params).
     * @returns {Promise<string>} A promise that resolves to the location link of the uploaded file.
     * @throws {Error} If there is an error during the file sending process.
     */

    async uploadBufferToBucket() {
        const ACL = this.s3Config.TESTOMATIO_PRIVATE_ARTIFACTS ? 'private' : 'public-read';

        return this.fileSending({
            Bucket: this.s3Config.S3_BUCKET,
            Key: this.bufferKey,
            buffer: this.buffer,
            ACL,
            file: undefined,
            ContentType: undefined
        })
    }
}

module.exports = S3Uploader;