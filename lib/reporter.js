const logger = require('./logger');
const TestomatClient = require('./client');
const TRConstants = require('./constants');
const TRArtifacts = require('./_ArtifactStorageOld');

const log = logger._log.bind(logger);
const step = logger.step.bind(logger);

module.exports = {
  logger,
  log,
  step,
  TestomatClient,
  TRConstants,
  TRArtifacts,
  addArtifact: TRArtifacts.artifact,
};
