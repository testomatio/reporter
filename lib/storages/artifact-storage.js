const debug = require('debug')('@testomatio/reporter:artifact-storage');
const os = require('os');
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

  // constructor() {
  //   this.dataStorage = new DataStorage('artifact');
  // }

  // singleton
  static getInstance() {
    if (!ArtifactStorage.instance) {
      ArtifactStorage.instance = new ArtifactStorage();
    }

    return ArtifactStorage.instance;
  }

  put(data, context = null) {
    if (!data) return;
    this.dataStorage.putData(data, context);
  }

  /**
   * Returns list of artifacts to upload
   * @param {*} context testId or test context from test runner
   * @returns {string | {path: string, type: string, name: string}[]}
   */
  get(context) {
    if (!context) return null;

    const artifactsData = this.dataStorage.getData(context);
    // if artifactsData is array
    let artifacts = artifactsData;
    if (typeof artifactsData === 'string') {
      artifacts = artifactsData.split(os.EOL);
    }
    if (!artifacts) return null;

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
