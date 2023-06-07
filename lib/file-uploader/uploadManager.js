const debug = require('debug')('@testomatio/reporter:file-uploader');
const memoize = require('lodash.memoize');
const Uploader = require("./uploader");
const AzureUploader = require("./azureUploader");
const S3Uploader = require("./s3Uploader");

/**
 * Handles file upload to Azure Blob Storage or AWS S3 based on the configuration
 * by filepath.
 * @param {string} filepath - The filepath to be uploaded.
 * @param {string} runId - The ID of the run or identifier for the file.
 */
const fileUploadByPath = async (filepath, runId) => {
    const fileInfo = {
        filepath,
        runId
    };
    // Check if Azure variables are defined
    const isAzureEnabled = Uploader.isAzureArtifactsEnabled();
    // Check if S3 variables are defined
    const isS3Enabled =  Uploader.isS3ArtifactsEnabled();

    debug(`FILE s3 enabled=${isS3Enabled} / FILE Azure enabled=${isAzureEnabled}`);

    if (isS3Enabled && isAzureEnabled) {
        debug("S3 storage uploading processing...");
        // Perform file upload to S3 Blob Storage
        return uploadFile(new S3Uploader(fileInfo));
    }
    if (isS3Enabled && !isAzureEnabled) {
        debug("S3 storage uploading processing...");
        // Perform file upload to S3 Blob Storage
        return uploadFile(new S3Uploader(fileInfo));
    }
    if (isAzureEnabled && !isS3Enabled) {
        debug("AZURE storage uploading processing...");
        // Perform file upload to Azure Blob Storage
        return uploadFile(new AzureUploader(fileInfo));
    }
};

/**
 * Handles file upload to Azure Blob Storage or AWS S3 based on the configuration
 * by buffer.
 * @param {Buffer} buffer - The buffer to be uploaded.
 * @param {string} filename - The existing filename of file.
 * @param {string} runId - The ID of the run or identifier for the file.
 */
const fileUploadByBuffer = async (buffer, filename, runId) => {
    const fileInfo = {
        filename,
        buffer,
        runId
    };
    // Check if Azure variables are defined
    const isAzureEnabled = Uploader.isAzureArtifactsEnabled();
    // Check if S3 variables are defined
    const isS3Enabled =  Uploader.isS3ArtifactsEnabled();

    debug(`FILE s3 enabled=${isS3Enabled} / FILE Azure enabled=${isAzureEnabled}`);

    if (isS3Enabled && isAzureEnabled) {
        debug("S3 storage uploading processing...");
        // Perform file upload to S3 Blob Storage
        return uploadBuffer(new S3Uploader(fileInfo));
    }
    if (isS3Enabled && !isAzureEnabled) {
        debug("S3 storage uploading processing...");
        // Perform file upload to S3 Blob Storage
        return uploadBuffer(new S3Uploader(fileInfo));
    }
    if (isAzureEnabled && !isS3Enabled) {
        debug("AZURE storage uploading processing...");
        // Perform file upload to Azure Blob Storage
        return uploadBuffer(new AzureUploader(fileInfo));
    }
};

/**
 * Uploads a file based on the buffer using the provided uploader object.
 *
 * @param {S3Uploader | AzureUploader} uploader - The uploader object responsible for the file upload.
 * @returns {Promise<string|undefined>} A promise that resolves to the URL of the uploaded file or undefined.
 */
async function uploadFile(uploader) {
    try {
        return await uploader.uploadFileToBucket();
    } catch (e) {
        uploader.uploadingBucketError(e);
    }
}

/**
 * Uploads a file using the provided uploader object.
 *
 * @param {S3Uploader | AzureUploader} uploader - The uploader object responsible for the file upload.
 * @returns {Promise<string|undefined>} A promise that resolves to the URL of the uploaded file or undefined.
 */
async function uploadBuffer(uploader) {
    try {
        return await uploader.uploadBufferToBucket();
    } catch (e) {
        uploader.uploadingBucketError(e);
    }
}

const s3StoreEnabled = () => Uploader.isS3ArtifactsEnabled();

const azureStoreEnabled = () => Uploader.isAzureArtifactsEnabled();

module.exports = {
    fileUploadByPath: memoize(fileUploadByPath),
    fileUploadByBuffer: memoize(fileUploadByBuffer),
    isArtifactsS3Enabled: memoize(s3StoreEnabled),
    isArtifactsAzureEnabled: memoize(azureStoreEnabled)
};
