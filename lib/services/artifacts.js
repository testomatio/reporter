"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.artifactStorage = void 0;
const debug_1 = __importDefault(require("debug"));
const data_storage_js_1 = require("../data-storage.js");
const debug = (0, debug_1.default)('@testomatio/reporter:services-artifacts');
/**
 * Artifact storage is supposed to store file paths
 */
class ArtifactStorage {
    static #instance;
    /**
     * Singleton
     * @returns {ArtifactStorage}
     */
    static getInstance() {
        if (!this.#instance) {
            this.#instance = new ArtifactStorage();
        }
        return this.#instance;
    }
    /**
     * Stores path to file as artifact and uploads it to the S3 storage
     * @param {string | {path: string, type: string, name: string}} data - path to file or object with path, type and name
     * @param {*} context testId or test title
     */
    put(data, context = null) {
        if (!data)
            return;
        debug('Save artifact:', data);
        data_storage_js_1.dataStorage.putData('artifact', data, context);
    }
    /**
     * Returns list of artifacts to upload
     * @param {*} context testId or test context from test runner
     * @returns {(string | {path: string, type: string, name: string})[]}
     */
    get(context) {
        let artifacts = data_storage_js_1.dataStorage.getData('artifact', context);
        if (!artifacts || !artifacts.length)
            return [];
        artifacts = artifacts.map(artifactData => {
            // artifact could be an object ({type, path, name} props) or string (just path)
            let artifact;
            try {
                artifact = JSON.parse(artifactData);
            }
            catch (e) {
                artifact = artifactData;
            }
            return artifact;
        });
        artifacts = artifacts.filter(artifact => !!artifact);
        debug(`Artifacts for test ${context}:`, artifacts);
        return artifacts.length ? artifacts : [];
    }
}
exports.artifactStorage = ArtifactStorage.getInstance();
