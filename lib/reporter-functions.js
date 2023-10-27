const logger = require('./storages/logger');
const artifactStorage = require('./storages/artifact-storage');

/**
 * Stores path to file as artifact and uploads it to the S3 storage
 * @param {string | {path: string, type: string, name: string}} data - path to file or object with path, type and name
 * @param {*} context testId or test title
 */
function saveArtifact(data, context = null) {
  if (!data) return;
  artifactStorage.put(data, context);
}

/**
 * Attach log message(s) to the test report
 * @param  {...any} args
 */
function logMessage(...args) {
  logger.log(...args);
}

/**
 * Similar to "log" function but marks message in report as a step
 * @param {*} message 
 */
function addStep(message) {
  logger.step(message);
}

module.exports = {
  artifact: saveArtifact,
  log: logMessage,
  step: addStep,
};
