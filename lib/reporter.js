const TestomatClient = require('./client');
const TRConstants = require('./constants');
const { services } = require('./services');

const reporterFunctions = require('./reporter-functions');

module.exports = {
  // TODO: deprecate in future; use log or testomat.log
  testomatioLogger: services.logger,

  artifact: reporterFunctions.artifact,
  log: reporterFunctions.log,
  logger: services.logger,
  meta: reporterFunctions.keyValue,
  step: reporterFunctions.step,

  TestomatClient,
  TRConstants,
};
