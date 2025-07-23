// import TestomatClient from './client.js';
// import * as TRConstants from './constants.js';
import { services } from './services/index.js';
import reporterFunctions from './reporter-functions.js';

export const artifact = reporterFunctions.artifact;
export const log = reporterFunctions.log;
export const logger = services.logger;
export const meta = reporterFunctions.keyValue;
export const step = reporterFunctions.step;
export const label = reporterFunctions.label;

/**
 * @typedef {typeof import('./reporter-functions.js').default.artifact} ArtifactFunction
 * @typedef {typeof import('./reporter-functions.js').default.log} LogFunction
 * @typedef {typeof import('./services/index.js').services.logger} LoggerService
 * @typedef {typeof import('./reporter-functions.js').default.keyValue} MetaFunction
 * @typedef {typeof import('./reporter-functions.js').default.step} StepFunction
 * @typedef {typeof import('./reporter-functions.js').default.label} LabelFunction
 */
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
  label: reporterFunctions.label,

  // TestomatClient,
  // TRConstants,
};
