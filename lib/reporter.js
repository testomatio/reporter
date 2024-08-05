import TestomatClient from './client.js';
import * as TRConstants from './constants.js';
import { services } from './services/index.js';
import reporterFunctions from './reporter-functions.js';

export default {
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

