const { logger } = require('./logger');
const { artifactStorage } = require('./artifacts');
const { keyValueStorage } = require('./key-values');
const { dataStorage } = require('../data-storage');

module.exports.services = {
  logger,
  artifacts: artifactStorage,
  keyValues: keyValueStorage,
  setContext: context => {
    dataStorage.setContext(context);
  },
};
