const debug = require('debug')('@testomatio/reporter:artifact-storage');
const DataStorage = require('./data-storage');

/**
 * Artifact storage is supposed to store file paths
 */
class ArtifactStorage {
  static #instance;

  #context;

  // there is autocompletion for the class methods if implemented singleton this way
  constructor() {
    this.dataStorage = new DataStorage('artifact');

    // singleton
    if (!ArtifactStorage.#instance) {
      ArtifactStorage.#instance = this;
    }
  }

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
   * @param {string} context - suite title + test title
   */
  setContext(context) {
    this.#context = context;
  }

  /**
   * Stores path to file as artifact and uploads it to the S3 storage
   * @param {string | {path: string, type: string, name: string}} data - path to file or object with path, type and name
   * @param {*} context testId or test title
   */
  put(data, context = null) {
    context = context || this.#context;
    if (!data) return;
    debug('Save artifact:', data);
    this.dataStorage.putData(data, context);
  }

  /**
   * Returns list of artifacts to upload
   * @param {*} context testId or test context from test runner
   * @returns {(string | {path: string, type: string, name: string})[]}
   */
  get(context) {
    let artifacts = this.dataStorage.getData(context);
    if (!artifacts || !artifacts.length) return [];

    artifacts = artifacts.map(artifactData => {
      // artifact could be an object ({type, path, name} props) or string (just path)
      let artifact;
      try {
        artifact = JSON.parse(artifactData);
      } catch (e) {
        artifact = artifactData;
      }
      return artifact;
    });
    artifacts = artifacts.filter(artifact => !!artifact);
    debug(`Artifacts for test ${context}:`, artifacts);
    return artifacts.length ? artifacts : [];
  }
}

module.exports.artifactStorage = ArtifactStorage.getInstance();
