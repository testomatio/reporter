const TestomatClient = require('./client');
const TRConstants = require('./constants');
const { services } = require('./services');

const reporterFunctions = require('./reporter-functions');

const testomat = {
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

module.exports = testomat;

module.exports.testomatioLogger = testomat;
module.exports.artifact = reporterFunctions.artifact;
module.exports.log = reporterFunctions.log;
module.exports.logger = services.logger;
module.exports.meta = reporterFunctions.keyValue;
module.exports.step = reporterFunctions.step;
module.exports.TestomatClient = TestomatClient;
module.exports.TRConstants = TRConstants;
