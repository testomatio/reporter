// const debug = require('debug')('@testomatio/reporter:logger');
const { DataStorage } = require('./dataStorage');

class ArtifactStorage {
  constructor() {
    this.dataStorage = new DataStorage('artifact');

    // singleton
    if (!ArtifactStorage.instance) {
      ArtifactStorage.instance = this;
    }
  }

  save(data, context = null) {
    this.dataStorage.putData(data, context);
  }

  get(context) {
    this.dataStorage.getData(context);
  }
}

ArtifactStorage.instance = null;

module.exports = new ArtifactStorage();
