const debug = require('debug')('@testomatio/reporter:s3-file-uploader');
const { S3 } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');

const Uploader = require("./Uploader");
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
                    s3ForcePathStyle: S3_FORCE_PATH_STYLE,
                }
            }

            if (S3_ENDPOINT) {
                this.s3Access.endpoint = S3_ENDPOINT;
            }
        }
    }

    s3WrongAccesseWarning() {
        const {
            S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_ENDPOINT, TESTOMATIO_PRIVATE_ARTIFACTS, S3_BUCKET
        } = this.s3Config;

        console.log('S3 wrong credentials', {
            accessKeyId: S3_ACCESS_KEY_ID,
            secretAccessKey: S3_SECRET_ACCESS_KEY ? '**** (hidden) ***' : '(empty)',
            region: S3_REGION,
            bucket: S3_BUCKET,
            acl: (TESTOMATIO_PRIVATE_ARTIFACTS ? 'private' : 'public-read'),
            endpoint: S3_ENDPOINT
        });
    }

    async s3FileSending(params) {
        let sendingPrms;

        const { S3_BUCKET, file, ContentType, Key, ACL, buffer } = params

        if (S3_BUCKET && file && ContentType) {
            sendingPrms = {
                Bucket: S3_BUCKET,
                Key: Key,
                Body: file,
                ContentType: ContentType,
                ACL: ACL
            }
        }

        if (S3_BUCKET && buffer && Key) {
            sendingPrms = {
                Bucket: S3_BUCKET,
                Key: Key,
                Body: buffer,
                ACL: ACL,
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
            this.unsuccessfullBufferUploadMsg();
            // additional incorrect S3 config message
            this.s3WrongAccesseWarning();
            // disable artifacts uploading msg
            this.disableArtifactsUploadWarning();
            // additional accesse to s3 worning
            this.accesseToStorageWarning(this.s3Config.TESTOMATIO_PRIVATE_ARTIFACTS);
        }
    }

    async sendFileToS3Bucket() {
        const file = this.fileByPath;

        const ACL = this.s3Config.TESTOMATIO_PRIVATE_ARTIFACTS ? 'private' : 'public-read';

        return await this.s3FileSending({
            Bucket: this.s3Config.S3_BUCKET,
            Key: this.fileKey,
            file,
            ContentType: this.contentType,
            ACL
        })
    }

    async sendBufferToS3Bucket() {
        const ACL = this.s3Config.TESTOMATIO_PRIVATE_ARTIFACTS ? 'private' : 'public-read';

        return await this.s3FileSending({
            Bucket: this.s3Config.S3_BUCKET,
            Key: this.bufferKey,
            buffer: this.buffer,
            ACL
        })
    }

    static isS3ArtifactsEnabled() {
        const enabled = !!(process.env.S3_BUCKET && !process.env.TESTOMATIO_DISABLE_ARTIFACTS);
        debug(`Upload is ${enabled ? 'enabled' : 'disabled'}`);

        return enabled;
    }
}

module.exports = S3Uploader;