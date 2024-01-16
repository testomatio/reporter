const TestomatClient = require('./client');
const TRConstants = require('./constants');

const reporterFunctions = require('./reporter-functions');

module.exports = {
  // TODO: deprecate in future; use log or testomat.log
  logger: reporterFunctions.log,
  testomatioLogger: reporterFunctions.log,

  artifact: reporterFunctions.artifact,
  log: reporterFunctions.log,
  meta: reporterFunctions.keyValue,
  step: reporterFunctions.step,

  TestomatClient,
  TRConstants,
};

