const { logger } = require('./logger');
const { artifactStorage } = require('./artifact-storage');
const { keyValueStorage } = require('./key-value-storage');

module.exports.storages = {
  logger,
  artifacts: artifactStorage,
  keyValues: keyValueStorage,
  setContext: context => {
    logger.setContext(context);
    artifactStorage.setContext(context);
    keyValueStorage.setContext(context);
  },
};
