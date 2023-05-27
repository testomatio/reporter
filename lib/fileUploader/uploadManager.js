const AzureUploader = require("./AzureUploader");
const S3Uploader = require("./S3Uploader");
const memoize = require('lodash.memoize');

/**
 * Handles file upload to Azure Blob Storage or AWS S3 based on the configuration
 * by filepath.
 * @param {string} filepath - The filepath to be uploaded.
 * @param {string} runId - The ID of the run or identifier for the file.
 */
const handleFileUploadByPath = async (runId, filepath) => {
    const fileInfo = {
        filepath,
        runId
    }

    const s3Uploading = new S3Uploader(fileInfo);
    const azureUploading = new AzureUploader(fileInfo);

    // Check if Azure variables are defined
    const isAzureEnabled = azureUploading.isAzureArtifactsEnabled;
    // Check if S3 variables are defined
    const isS3Enabled =  s3Uploading.isS3ArtifactsEnabled;

    if (isS3Enabled && !isAzureEnabled) {
        // Perform file upload to S3 Blob Storage
        try {
            return await s3Uploading.sendFileToS3Bucket();
        } catch (e) {
            s3Uploading.uploadingBucketError("S3", e);
        }
    } else if (isAzureEnabled && !isS3Enabled) {
        // Perform file upload to Azure Blob Storage
        try {
            return await azureUploading.sendFileToAzureBucket();
        } catch (e) {
            azureUploading.uploadingBucketError("Azure", e);
        }
    } else if (isS3Enabled && isAzureEnabled) {
        // Perform file upload to S3 Blob Storage by dafault (if S3 & Azure are assigned)
        try {
            return await s3Uploading.sendFileToS3Bucket();
        } catch (e) {
            s3Uploading.uploadingBucketError("S3", e);
        }
    }
     else {
        console.error('No settings found for Azure Blob Storage or AWS S3');
    }
};

/**
 * Handles file upload to Azure Blob Storage or AWS S3 based on the configuration
 * by buffer.
 * @param {string} filename - The existing filename of file.
 * @param {Buffer} buffer - The buffer to be uploaded.
 * @param {string} runId - The ID of the run or identifier for the file.
 */
const handleFileUploadByBuffer = async (runId, buffer, filename) => {
    const fileInfo = {
        filename,
        buffer,
        runId
    }

    const s3Uploading = new S3Uploader(fileInfo);
    const azureUploading = new AzureUploader(fileInfo);

    // Check if Azure variables are defined
    const isAzureEnabled = azureUploading.isAzureArtifactsEnabled;
    // Check if S3 variables are defined
    const isS3Enabled =  s3Uploading.isS3ArtifactsEnabled;

    if (isS3Enabled && !isAzureEnabled) {
        // Perform file upload to S3 Blob Storage
        try {
            return await s3Uploading.sendBufferToS3Bucket();
        } catch (e) {
            s3Uploading.uploadingBucketError("S3", e);
        }
    } else if (isAzureEnabled && !isS3Enabled) {
        // Perform file upload to Azure Blob Storage
        try {
            return await azureUploading.sendBufferToAzureBucket();
        } catch (e) {
            azureUploading.uploadingBucketError("Azure", e);
        }
    } else if (isS3Enabled && isAzureEnabled) {
        // Perform file upload to S3 Blob Storage by dafault (if S3 & Azure are assigned)
        try {
            return await s3Uploading.sendBufferToS3Bucket();
        } catch (e) {
            s3Uploading.uploadingBucketError("S3", e);
        }
    }
     else {
        console.error('No settings found for Azure Blob Storage or AWS S3');
    }
};

module.exports = {
    handleFileUploadByPath: memoize(handleFileUploadByPath),
    handleFileUploadByBuffer: memoize(handleFileUploadByBuffer),
    // TODO: think about - use static methods
    // isArtifactsS3Enabled: memoize(),
    // isArtifactsAzureEnabled: memoize()
};
