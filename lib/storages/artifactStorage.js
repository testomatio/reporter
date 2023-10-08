const { DataStorage } = require('./dataStorage');
const os = require('os');
const debug = require('debug')('@testomatio/reporter:artifact-storage');

/**
 * Artifact storage is supposed to store file paths
 */
class ArtifactStorage {
  constructor() {
    this.dataStorage = new DataStorage('artifact');

    // singleton
    if (!ArtifactStorage.instance) {
      ArtifactStorage.instance = this;
    }
  }

  put(data, context = null) {
    this.dataStorage.putData(data, context);
  }

  /**
   * Returns list of artifacts to upload
   * @param {*} context testId or test context from test runner
   * @returns {string | {path: string, type: string, name: string}[]}
   */
  get(context) {
    const artifactsData = this.dataStorage.getData(context).split(os.EOL);
    let artifacts = artifactsData.map(artifactData => {
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
    return artifacts;
  }
}

ArtifactStorage.instance = null;

module.exports = new ArtifactStorage();