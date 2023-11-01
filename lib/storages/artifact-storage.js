const debug = require('debug')('@testomatio/reporter:artifact-storage');
const DataStorage = require('./data-storage');

/**
 * Artifact storage is supposed to store file paths
 */
class ArtifactStorage {

  // there is autocompletion for the class methods if implemented singleton this way
  constructor() {
    this.dataStorage = new DataStorage('artifact');
    
    // singleton
    if (!ArtifactStorage.instance) {
      ArtifactStorage.instance = this;
    }
  }

  // singleton
  static getInstance() {
    if (!ArtifactStorage.instance) {
      ArtifactStorage.instance = new ArtifactStorage();
    }

    return ArtifactStorage.instance;
  }

  /**
   * Stores path to file as artifact and uploads it to the S3 storage
   * @param {string | {path: string, type: string, name: string}} data - path to file or object with path, type and name
   * @param {*} context testId or test title
   */
  put(data, context = null) {
    if (!data) return;
    debug('Save artifact:', data);
    this.dataStorage.putData(data, context);
  }

  /**
   * Returns list of artifacts to upload
   * @param {*} context testId or test context from test runner
   * @returns {string | {path: string, type: string, name: string}[]}
   */
  get(context) {
    if (!context) return null;

    // array of any data
    let artifacts = this.dataStorage.getData(context);
    if (!artifacts || !artifacts.length) return null;

    artifacts = artifacts.map(artifactData => {
      // artifact could be an object ({type, path, name} props) or string
      let artifact;
      try {
        artifact = JSON.parse(artifactData);
      } catch (e) {
        artifact = artifactData;
      }
      return artifact;
    });
    artifacts = artifacts.filter(artifact => !!artifact);
    return artifacts.length ? artifacts : null;
  }
}

ArtifactStorage.instance = null;

// const artifactStorage = ArtifactStorage.getInstance();
const artifactStorage = new ArtifactStorage();
module.exports = artifactStorage;
