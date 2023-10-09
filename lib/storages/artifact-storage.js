const DataStorage = require('./data-storage');
const os = require('os');
const debug = require('debug')('@testomatio/reporter:artifact-storage');

/**
 * Artifact storage is supposed to store file paths
 */
class ArtifactStorage {
  constructor() {
    // singleton
    if (!ArtifactStorage.instance) {
      this.dataStorage = new DataStorage('artifact');
      ArtifactStorage.instance = this;
    }
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
    if (!context) return [];
    const artifactsData = this.dataStorage.getData(context)?.split(os.EOL);
    if (!artifactsData) return [];
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

const artifactStorageIns = new ArtifactStorage();

module.exports = artifactStorageIns;
