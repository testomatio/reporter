const logger = require('./storages/logger');
const TestomatClient = require('./client');
const TRConstants = require('./constants');
const TRArtifacts = require('./_ArtifactStorageOld');
const artifactStorage = require('./storages/artifactStorage');

const log = logger.templateLiteralLog.bind(logger);
const step = logger.step.bind(logger);
const testomat = {
  artifact: artifactStorage.put.bind(artifactStorage),
}

module.exports = {
  logger,
  testomatioLogger: logger,
  log,
  step,
  TestomatClient,
  TRConstants,
  TRArtifacts,
  addArtifact: TRArtifacts.artifact,
  testomat,
};
