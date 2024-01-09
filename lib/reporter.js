const { services } = require('./services');
const TestomatClient = require('./client');
const TRConstants = require('./constants');

const logger = services.logger;

// TODO: should be deprecated, reporter-functions should be used instead
const log = logger.templateLiteralLog.bind(logger);
const step = logger.step.bind(logger);

const reporterFunctions = require('./reporter-functions');

module.exports = {
  // duplications; no difference
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
  _setStorageContext: reporterFunctions._setStorageContext,
};
