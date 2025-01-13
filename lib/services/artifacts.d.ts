export const artifactStorage: ArtifactStorage;
/**
 * Artifact storage is supposed to store file paths
 */
declare class ArtifactStorage {
    static "__#13@#instance": any;
    /**
     * Singleton
     * @returns {ArtifactStorage}
     */
    static getInstance(): ArtifactStorage;
    /**
     * Stores path to file as artifact and uploads it to the S3 storage
     * @param {string | {path: string, type: string, name: string}} data - path to file or object with path, type and name
     * @param {*} context testId or test title
     */
    put(data: string | {
        path: string;
        type: string;
        name: string;
    }, context?: any): void;
    /**
     * Returns list of artifacts to upload
     * @param {*} context testId or test context from test runner
     * @returns {(string | {path: string, type: string, name: string})[]}
     */
    get(context: any): (string | {
        path: string;
        type: string;
        name: string;
    })[];
}
export {};
