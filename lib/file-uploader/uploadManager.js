const debug = require('debug')('@testomatio/reporter:file-uploader');
const Uploader = require("./uploader");
const AzureUploader = require("./azureUploader");
const S3Uploader = require("./s3Uploader");
const memoize = require('lodash.memoize');

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
        const s3Uploading = new S3Uploader(fileInfo);

        try {            
            return await s3Uploading.uploadFileToS3Bucket();
        } catch (e) {
            s3Uploading.uploadingBucketError("S3", e);
        }
    }
    if (isS3Enabled && !isAzureEnabled) {
        debug("S3 storage uploading processing...");
        // Perform file upload to S3 Blob Storage
        const s3Uploading = new S3Uploader(fileInfo);

        try {            
            return await s3Uploading.uploadFileToS3Bucket();
        } catch (e) {
            s3Uploading.uploadingBucketError("S3", e);
        }
    }
    if (isAzureEnabled && !isS3Enabled) {
        debug("AZURE storage uploading processing...");
        // Perform file upload to Azure Blob Storage
        const azureUploading = new AzureUploader(fileInfo);

        try {
            return await azureUploading.uploadFileToAzureBucket();
        } catch (e) {
            azureUploading.uploadingBucketError("Azure", e);
        }
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
        const s3Uploading = new S3Uploader(fileInfo);
        // Perform file upload to S3 Blob Storage
        try {
            return await s3Uploading.uploadBufferToS3Bucket();
        } catch (e) {
            s3Uploading.uploadingBucketError("S3", e);
        }
    }
    if (isS3Enabled && !isAzureEnabled) {
        debug("S3 storage uploading processing...");
        const s3Uploading = new S3Uploader(fileInfo);
        // Perform file upload to S3 Blob Storage
        try {
            return await s3Uploading.uploadBufferToS3Bucket();
        } catch (e) {
            s3Uploading.uploadingBucketError("S3", e);
        }
    }
    if (isAzureEnabled && !isS3Enabled) {
        debug("AZURE storage uploading processing...");
        const azureUploading = new AzureUploader(fileInfo);
        // Perform file upload to Azure Blob Storage
        try {
            return await azureUploading.uploadBufferToAzureBucket();
        } catch (e) {
            azureUploading.uploadingBucketError("Azure", e);
        }
    }
};

const s3StoreEnabled = () => {
    return Uploader.isS3ArtifactsEnabled();
}

const azureStoreEnabled = () => {
    return Uploader.isAzureArtifactsEnabled();
}

module.exports = {
    fileUploadByPath: memoize(fileUploadByPath),
    fileUploadByBuffer: memoize(fileUploadByBuffer),
    isArtifactsS3Enabled: memoize(s3StoreEnabled),
    isArtifactsAzureEnabled: memoize(azureStoreEnabled)
};
