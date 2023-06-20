const logger = require('./logger');
const TestomatClient = require('./client');
const TRConstants = require('./constants');
const TRArtifacts = require('./_ArtifactStorageOld');
const Output = require('./output');

module.exports = {
  logger,
  TestomatClient,
  TRConstants,
  TRArtifacts,
  addArtifact: TRArtifacts.artifact,
};
