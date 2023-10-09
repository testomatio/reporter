const logger = require('./storages/logger');
const TestomatClient = require('./client');
const TRConstants = require('./constants');
const artifactStorage = require('./storages/artifact-storage');

const log = logger.templateLiteralLog.bind(logger);
const step = logger.step.bind(logger);

module.exports = {
  logger,
  testomatioLogger: logger,
  log,
  step,
  TestomatClient,
  TRConstants,
  testomat: {
    artifact: artifactStorage.put.bind(artifactStorage),
  }
};
