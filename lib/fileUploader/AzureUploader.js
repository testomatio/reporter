const debug = require('debug')('@testomatio/reporter:s3-file-uploader');
const { BlobServiceClient, BlobSASPermissions } = require('@azure/storage-blob');

const Uploader = require("./Uploader");
const { UPLOAD_AZURE_KEYS } = require('../constants');

class AzureUploader extends Uploader {
    
    constructor(opts) {
        super(opts);
        this.azureKeys = UPLOAD_AZURE_KEYS;
        this.azureConfig = Uploader.envPreparation(this.azureKeys);

        if (Object.keys(this.azureConfig).length > 1) {
            const { AZURE_STORAGE_CONNECTION_STRING, AZURE_CONTAINER_NAME } = this.azureConfig
            // azureAccess -> for possible future updates
            this.azureAccess = {
                connectionString: AZURE_STORAGE_CONNECTION_STRING,
                containerName: AZURE_CONTAINER_NAME
            }
            this.azureHeaders = {
                "blobHTTPHeaders": {
                  "blobContentType": this.contentType
                }
            }
        }                
    }

    get isAzureArtifactsEnabled() {
        if (this.enabled !== undefined) return this.enabled;

        this.enabled = !!(this.azureConfig.AZURE_STORAGE_CONNECTION_STRING && !this.azureConfig.TESTOMATIO_DISABLE_ARTIFACTS);
        debug(`Upload is ${this.enabled  ? 'enabled' : 'disabled'}`);

        return this.enabled;
    }

    azureWrongAccesseWarning() {
        console.log('AZURE wrong credentials', {
            connectionString: this.azureConfig.AZURE_STORAGE_CONNECTION_STRING ? '**** (hidden) ***' : '(empty)',
            containerName: this.azureConfig.AZURE_CONTAINER_NAME
        });
    }

    privateFileLinkGenerate(blockBlobClient, isPrivate) {
        // additional accesse to AZURE worning
        this.accesseToStorageWarning(isPrivate);

        // Set public access level for the blob
        const permissions = new BlobSASPermissions();
        permissions.read = true;
        permissions.write = false;
        permissions.delete = false;
    
        const startDate = new Date();
        startDate.setMinutes(startDate.getMinutes() - 5); // Start the SAS token 5 minutes before current time
        const endDate = new Date();
        endDate.setFullYear(endDate.getFullYear() + 1); // Set the expiration date to 1 year from now
    
        const sasToken = blockBlobClient.generateSasUrl({
            permissions,
            startsOn: startDate,
            expiresOn: endDate
        });
    
        const blobUrlWithSas = `${blockBlobClient.url}?${sasToken}`;
        debug('Publicly accessible URL:', blobUrlWithSas);
        console.log('Publicly accessible URL:', blobUrlWithSas);

        return blobUrlWithSas;
    }

    async azureFileSending(params) {
        const { connectionString, containerName, file, buffer, isPrivate} = params;

        try {
            if (connectionString && containerName && file) {
                const blobServiceClient = BlobServiceClient.fromConnectionString(this.azureAccess.connectionString);
                const containerClient = blobServiceClient.getContainerClient(this.azureAccess.containerName);
                const blockBlobClient = containerClient.getBlockBlobClient(this.fileKey);

                await blockBlobClient.upload(
                    file, 
                    file.length, 
                    this.azureHeaders
                );

                if (!isPrivate) {
                    this.privateFileLinkGenerate(blockBlobClient, isPrivate);
                }
                else {
                    const azureUploadedUrl = blockBlobClient.url;
                    debug('Publicly file accessible URL', azureUploadedUrl)
                    console.log('Publicly file accessible URL:', azureUploadedUrl);
        
                    return azureUploadedUrl;
                }
            }

            if (connectionString && containerName && buffer) {
                const blobServiceClient = BlobServiceClient.fromConnectionString(this.azureAccess.connectionString);
                const containerClient = blobServiceClient.getContainerClient(this.azureAccess.containerName);
                const blockBlobClient = containerClient.getBlockBlobClient(this.fileKey);

                await blockBlobClient.uploadData(
                    buffer, 
                    this.azureHeaders
                );

                if (!isPrivate) {
                    this.privateFileLinkGenerate(blockBlobClient, isPrivate);
                }
                else {
                    const azureUploadedUrl = blockBlobClient.url;
                    debug('Publicly buffer accessible URL', azureUploadedUrl)
                    console.log('Publicly buffer accessible URL:', azureUploadedUrl);
        
                    return azureUploadedUrl;
                }
            }
            // if there are no required values, exit the function
            return;
        }
        catch (e) {
            this.unsuccessfullBufferUploadMsg();
            // additional incorrect AZURE config message
            this.azureWrongAccesseWarning();
            // disable artifacts uploading msg
            this.disableArtifactsUploadWarning();
        }
    }

    async sendFileToAzureBucket() {
        const file = this.fileByPath;

        const isPrivate = this.azureConfig.TESTOMATIO_PRIVATE_ARTIFACTS ? true : false;

        return await this.azureFileSending({
            connectionString: this.azureAccess.connectionString,
            containerName: this.azureAccess.containerName,
            file, 
            isPrivate
        })
    }

    async sendBufferToAzureBucket() {
        const isPrivate = this.azureConfig.TESTOMATIO_PRIVATE_ARTIFACTS ? true : false;

        return await this.azureFileSending({
            connectionString: this.azureAccess.connectionString,
            containerName: this.azureAccess.containerName,
            buffer: this.buffer, 
            isPrivate
        })
    }
}

module.exports = AzureUploader;