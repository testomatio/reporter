const TestomatClient = require('./client');
const TRConstants = require('./constants');
const TRArtifacts = require('./ArtifactStorage');

module.exports = {
  TestomatClient,
  TRConstants,
  TRArtifacts,
  addArtifact: TRArtifacts.artifact,
};
