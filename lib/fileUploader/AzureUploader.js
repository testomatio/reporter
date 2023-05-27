const debug = require('debug')('@testomatio/reporter:s3-file-uploader');
const { BlobServiceClient } = require('@azure/storage-blob');
const fs = require('fs');
const { randomUUID } = require('crypto');
const path = require('path');

const Uploader = require("./Uploader");
const { UPLOAD_AZURE_KEYS } = require('../constants');

class AzureUploader extends Uploader {
    
    constructor(opts) {
        super(opts);
        this.keys = UPLOAD_AZURE_KEYS;

        if (this.keys.length > 1) {
            this.azureOnlyConfig = this.keys.reduce((acc, key) => {
                acc[key] = process.env[key];
                return acc;
            }, {});

            const basicConfig = super.config();

            this.azureConfig = Object.assign(basicConfig, this.azureOnlyConfig);

            this.azureAccess = {
                connectionString: this.azureConfig.AZURE_STORAGE_CONNECTION_STRING,
                containerName: this.azureConfig.AZURE_CONTAINER_NAME
            }
        }
        // TODO: move to the basic class ******
        if (typeof this.filepath === 'object') {
            this.contentType = this.filepath.type;
            this.filePath = this.filepath.path;
            this.azureKey = this.filepath.name;
        }
                
    }

    //TODO: maybe as super.method()
    get isAzureArtifactsEnabled() {
        this.enabled = !!(this.azureAccess.connectionString && !this.isArtifactsEnabled);

        debug(`Upload is ${this.enabled  ? 'enabled' : 'disabled'}`);

        return this.enabled;
    }

    azureWrongAccesseWarning() {
        console.log('AZURE wrong credentials', {
            connectionString: this.azureAccess.connectionString,
            // secretAccessKey: S3_SECRET_ACCESS_KEY ? '**** (hidden) ***' : '(empty)',
            containerName: this.azureAccess.containerName
        });
    }

    async azureFileUploading() {
        this.confirmFilepath(this.filepath); //TODO: обернуть этот и метод ниже для получения file  в один метод
                                            // он должен быть в родительском класе что бы не дергать const fs = require('fs');

        const file = fs.readFileSync(this.filepath);

        const ACL = this.azureConfig.TESTOMATIO_PRIVATE_ARTIFACTS ? 'private' : 'public-read';
        //TODO: find how use public/ private Keys!!!

        const Key = `${this.runId}/${randomUUID()}-${this.azureKey || path.basename(this.filepath)}`;

        const blobServiceClient = BlobServiceClient.fromConnectionString(this.azureAccess.connectionString);

        try {
            const containerClient = blobServiceClient.getContainerClient(AZURE_CONTAINER_NAME);
            const blockBlobClient = containerClient.getBlockBlobClient(Key);
        
            await blockBlobClient.upload(file, file.length, {
              'blobHTTPHeaders': {
                'blobContentType': this.contentType
              }
            });
        
            const azureUploadedUrl = blockBlobClient.url;
            debug('Uploaded filelink', azureUploadedUrl)
        
            return azureUploadedUrl;
        } catch (e) {
            this.buildUnsuccessfullUploadMsg();
            // additional incorrect S3 config message
            this.azureWrongAccesseWarning();
            //TODO: need to check
            //  // disable artifacts uploading msg
            //  this.disableArtifactsUploadWarning();
            //  // additional accesse to s3 worning
            //  this.accesseToStorageWarning();
        }
    }

    // get uploadFileByPath() {
    //     return memoize(this.uploadFileByPath);
    //     //TODO: think about memoize - нужно не забыть переиспользовать мемайз!!
    // }

    async uploadFileByPath() {
        // check that artifacts is enabled
        const enabled = this.isAzureArtifactsEnabled;

        try {
            if (enabled) {
              return this.azureFileUploading();
            }
        } catch (e) {
            this.uploadingBucketError("Azure", e);
        }
    }

    async uploadFileAsBuffer() {
        //TODO: actions
    }
}

module.exports = AzureUploader;