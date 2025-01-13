export class S3Uploader {
    isEnabled: any;
    storeEnabled: boolean;
    config: {};
    /**
     * @type {{path: string, size: number}[]}
     */
    skippedUploads: {
        path: string;
        size: number;
    }[];
    failedUploads: any[];
    /**
     * @type {{path: string, size: number, link: string}[]}
     */
    successfulUploads: {
        path: string;
        size: number;
        link: string;
    }[];
    configKeys: string[];
    resetConfig(): void;
    /**
     *
     * @returns {Record<string, string>}
     */
    getConfig(): Record<string, string>;
    getMaskedConfig(): {
        [k: string]: string;
    };
    checkEnabled(): any;
    enableLogStorage(): void;
    disableLogStorage(): void;
    /**
     * Returns an array of uploaded files
     *
     * @returns {{rid: string, file: string, uploaded: boolean}[]}
     */
    readUploadedFiles(runId: any): {
        rid: string;
        file: string;
        uploaded: boolean;
    }[];
    storeUploadedFile(filePath: any, runId: any, rid: any, uploaded?: boolean): void;
    /**
     * @param {*} filePath
     * @param {*} pathInS3 contains runId, rid and filename
     * @returns
     */
    uploadFileByPath(filePath: any, pathInS3: any): Promise<any>;
    /**
     * @param {Buffer} buffer
     * @param {string[]} pathInS3
     * @returns
     */
    uploadFileAsBuffer(buffer: Buffer, pathInS3: string[]): Promise<any>;
    checkArtifactExistsInFileSystem(filePath: any, attempts?: number, intervalMs?: number): Promise<any>;
    getS3LocationLink(out: any): Promise<any>;
    #private;
}
