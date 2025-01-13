// import TestomatClient from './client.js';
// import * as TRConstants from './constants.js';
import { services } from './services/index.js';
import reporterFunctions from './reporter-functions.js';

export default {
  /**
   * @deprecated Use `log` or `testomat.log`
   */
  testomatioLogger: services.logger,

  artifact: reporterFunctions.artifact,
  log: reporterFunctions.log,
  logger: services.logger,
  meta: reporterFunctions.keyValue,
  step: reporterFunctions.step,

  // TestomatClient,
  // TRConstants,
};

export const artifact = reporterFunctions.artifact;
export const log = reporterFunctions.log;
export const logger = services.logger;
export const meta = reporterFunctions.keyValue;
export const step = reporterFunctions.step;
