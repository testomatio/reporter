const logger = require('./logger');
const TestomatClient = require('./client');
const TRConstants = require('./constants');
const TRArtifacts = require('./_ArtifactStorageOld');

const log = logger.templateLiteralLog.bind(logger);
const step = logger.step.bind(logger);

module.exports = {
  logger,
  testomatioLogger: logger,
  log,
  step,
  TestomatClient,
  TRConstants,
  TRArtifacts,
  addArtifact: TRArtifacts.artifact,
};
