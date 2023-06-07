const debug = require('debug')('@testomatio/reporter:file-uploader');
const { BlobServiceClient, BlobSASPermissions } = require('@azure/storage-blob');
const chalk = require('chalk');

const Uploader = require("./uploader");
const { UPLOAD_AZURE_KEYS } = require('../constants');

class AzureUploader extends Uploader {
    constructor(opts) {
        super(opts);
        this.azureKeys = UPLOAD_AZURE_KEYS;
        this.azureConfig = Uploader.envPreparation(this.azureKeys);

        if (Object.keys(this.azureConfig).length > 1) {
            const { AZURE_DEFAULT_ENDPOINTS_PROTOCOL, AZURE_ACCOUNT_NAME, AZURE_ACCOUNT_KEY,
                AZURE_ENDPOINT_SUFFIX, AZURE_CONTAINER_NAME } = this.azureConfig

            this.azureAccess = {
                connectionString: "DefaultEndpointsProtocol=" + AZURE_DEFAULT_ENDPOINTS_PROTOCOL + ";"
                    + "AccountName=" + AZURE_ACCOUNT_NAME + ";"
                    + "AccountKey=" + AZURE_ACCOUNT_KEY + ";"
                    + "EndpointSuffix=" + AZURE_ENDPOINT_SUFFIX,
                containerName: AZURE_CONTAINER_NAME
            }
            this.azureHeaders = {
                "blobHTTPHeaders": {
                    "blobContentType": this.contentType
                }
            }
        }
    }

    wrongAccesseWarning() {
        console.log(this.prefix, '---------------');

        console.log(this.prefix, chalk.bold.red(`Failed uploading '${this.fileKey}'. Please check AZURE credentials`), {
            defaultEndpointsProtocol: this.azureConfig.AZURE_DEFAULT_ENDPOINTS_PROTOCOL,
            accountKey: this.azureConfig.AZURE_ACCOUNT_KEY ? '**** (hidden) ***' : '(empty)',
            accountName: this.azureConfig.AZURE_ACCOUNT_NAME,            
            endpointSuffix: this.azureConfig.AZURE_ENDPOINT_SUFFIX,
            containerName: this.azureConfig.containerName
        });
        console.log(this.prefix, '---------------');
    }
    /**
     * Retrieves a readonly link for the given blockBlobClient using a shared access signature (SAS) token.
     * @param {BlockBlobClient} blockBlobClient - The BlockBlobClient representing the block blob.
     * @returns {Promise<string>} A promise that resolves to the private accessible URL with the generated SAS token.
     */
    async getReadonlyFileLink(blockBlobClient) {
        // Set public access level for the blob
        const permissions = new BlobSASPermissions();
        permissions.read = true;
        permissions.write = false;
        permissions.delete = false;

        const startDate = new Date();
        startDate.setMinutes(startDate.getMinutes() - 5); // Start the SAS token 5 minutes before current time
        const endDate = new Date();
        endDate.setFullYear(endDate.getFullYear() + 1); // Set the expiration date to 1 year from now

        const azureUrlWithsasToken = await blockBlobClient.generateSasUrl({
            permissions,
            startsOn: startDate,
            expiresOn: endDate
        });
        debug('Private accessible URL:', azureUrlWithsasToken);

        return azureUrlWithsasToken;
    }
    /**
     * Sends a file or buffer to Azure Blob Storage based on the provided parameters.
     * If the file or buffer is successfully uploaded, it returns the URL of the uploaded file.
     * If the file or buffer is marked as private (isPrivate = true), it returns a readonly link with a shared access signature (SAS) token.
     *
     * @param {Object} params - The parameters required for file sending.
     * @param {string} params.connectionString - The connection string for Azure Blob Storage.
     * @param {string} params.containerName - The name of the container in Azure Blob Storage.
     * @param {Buffer} params.file - The file to be sent as a buffer.
     * @param {Buffer} params.buffer - The buffer containing the file data.
     * @param {boolean} params.isPrivate - Indicates whether the file is marked as private.
     * @returns {Promise<string|undefined>} A promise that resolves to the URL of the uploaded file or a readonly link with a SAS token.
     * @throws {Error} If the required parameters (connectionString, containerName, file/buffer) are not provided.
     */
    async fileSending(params) {
        const { connectionString, containerName, file, buffer, isPrivate } = params;

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
                    const azureUploadedUrl = blockBlobClient.url;
                    debug('Publicly file accessible URL', azureUploadedUrl);

                    return azureUploadedUrl;                    
                }
                else {
                    return await this.getReadonlyFileLink(blockBlobClient);
                }
            }

            else if (connectionString && containerName && buffer) {
                const blobServiceClient = BlobServiceClient.fromConnectionString(this.azureAccess.connectionString);
                const containerClient = blobServiceClient.getContainerClient(this.azureAccess.containerName);
                const blockBlobClient = containerClient.getBlockBlobClient(this.fileKey);

                await blockBlobClient.uploadData(
                    buffer,
                    this.azureHeaders
                );

                if (!isPrivate) {
                    const azureUploadedUrl = blockBlobClient.url;
                    debug('Publicly buffer accessible URL', azureUploadedUrl)
                    
                    return azureUploadedUrl;
                }
                else {
                    return await this.getReadonlyFileLink(blockBlobClient);
                }
            }
            // if there are no required values, exit the function
            else {
                return;
            }
        }
        catch (e) {
            debug("AZURE file sending", e);
            // additional incorrect AZURE config message
            this.wrongAccesseWarning();
            // disable artifacts uploading msg / private msg
            this.accesseToStorageWarning();
        }
    }
    /**
     * Uploads a file to the Azure Blob Storage bucket (based on the file)
     *
     * @returns {Promise<string|undefined>} A promise that resolves to the URL of the uploaded file or a readonly link with a SAS token.
     * @throws {Error} If the required parameters (connectionString, containerName, file/buffer) are not provided.
     */
    async uploadFileToBucket() {
        const file = this.fileByPath;

        const isPrivate = this.azureConfig.TESTOMATIO_PRIVATE_ARTIFACTS ? true : false;

        return await this.fileSending({
            connectionString: this.azureAccess.connectionString,
            containerName: this.azureAccess.containerName,
            file,
            buffer: undefined,
            isPrivate
        })
    }
    /**
     * Uploads a file to the Azure Blob Storage bucket (based on the buffer)
     *
     * @returns {Promise<string|undefined>} A promise that resolves to the URL of the uploaded file or a readonly link with a SAS token.
     * @throws {Error} If the required parameters (connectionString, containerName, file/buffer) are not provided.
     */
    async uploadBufferToBucket() {
        const isPrivate = this.azureConfig.TESTOMATIO_PRIVATE_ARTIFACTS ? true : false;

        return await this.fileSending({
            connectionString: this.azureAccess.connectionString,
            containerName: this.azureAccess.containerName,
            file: undefined,
            buffer: this.buffer,
            isPrivate
        })
    }
}

module.exports = AzureUploader;