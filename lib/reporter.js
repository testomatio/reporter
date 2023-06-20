const logger = require('./logger');
const TestomatClient = require('./client');
const TRConstants = require('./constants');
const TRArtifacts = require('./_ArtifactStorageOld');
const Output = require('./output');
const log = logger._log.bind(logger);

module.exports = {
  logger,
  log,
  TestomatClient,
  TRConstants,
  TRArtifacts,
  addArtifact: TRArtifacts.artifact,
};
