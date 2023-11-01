const logger = require('./storages/logger');
const TestomatClient = require('./client');
const TRConstants = require('./constants');

const log = logger.templateLiteralLog.bind(logger);
const step = logger.step.bind(logger);
const reporterFunctions = require('./reporter-functions');

module.exports = {
  logger,
  testomatioLogger: logger,
  log,
  step,
  TestomatClient,
  TRConstants,
};

module.exports.testomat = {
  artifact: reporterFunctions.artifact,
  log: reporterFunctions.log,
  step: reporterFunctions.step,
  meta: reporterFunctions.keyValue,
};
