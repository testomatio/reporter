const logger = require('./storages/logger');
const artifactStorage = require('./storages/artifact-storage');
const keyValueStorage = require('./storages/key-value-storage');

/**
 * Stores path to file as artifact and uploads it to the S3 storage
 * @param {string | {path: string, type: string, name: string}} data - path to file or object with path, type and name
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

/**
 * Add key-value pair(s) to the test report
 * @param {*} keyValue 
 */
function setKeyValue(keyValue) {
  keyValueStorage.put(keyValue);
}

module.exports = {
  artifact: saveArtifact,
  log: logMessage,
  step: addStep,
  keyValue: setKeyValue,
};
