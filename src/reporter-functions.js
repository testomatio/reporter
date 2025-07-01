import { services } from './services/index.js';

/**
 * Stores path to file as artifact and uploads it to the S3 storage
 * @param {string | {path: string, type: string, name: string}} data - path to file or object with path, type and name
 */
function saveArtifact(data, context = null) {
  if (process.env.IS_PLAYWRIGHT)
    throw new Error(`This function is not available in Playwright framework.
    /Playwright supports artifacts out of the box`);
  if (!data) return;
  services.artifacts.put(data, context);
}

/**
 * Attach log message(s) to the test report
 * @param  string
 */
function logMessage(...args) {
  if (process.env.IS_PLAYWRIGHT) throw new Error('This function is not available in Playwright framework');
  services.logger._templateLiteralLog(...args);
}

/**
 * Similar to "log" function but marks message in report as a step
 * @param {string} message
 */
function addStep(message) {
  if (process.env.IS_PLAYWRIGHT)
    throw new Error('This function is not available in Playwright framework. Use playwright steps');

  services.logger.step(message);
}

/**
 * Add key-value pair(s) to the test report
 * @param {{[key: string]: string} | string} keyValue object { key: value } (multiple props allowed) or key (string)
 * @param {string?} value
 */
function setKeyValue(keyValue, value = null) {
  if (process.env.IS_PLAYWRIGHT)
    throw new Error('This function is not available in Playwright framework. Use test tag instead.');

  if (typeof keyValue === 'string') {
    keyValue = { [keyValue]: value };
  }
  services.keyValues.put(keyValue);
}

/**
 * Add a single label to the test report
 * @param {string} key - label key (e.g. 'severity', 'feature', or just 'smoke' for labels without values)
 * @param {string} [value] - optional label value (e.g. 'high', 'login')
 */
function setLabel(key, value = null) {
  if (!key || typeof key !== 'string') {
    console.warn('Label key must be a non-empty string');
    return;
  }

  // Limit key length to 255 characters
  if (key.length > 255) {
    console.warn('Label key is too long, trimmed to 255 characters:', key);
    key = key.substring(0, 255);
  }

  let labelString = key;
  if (value !== null && value !== undefined && value !== '') {
    if (typeof value !== 'string') {
      console.warn('Label value must be a string, converting:', value);
      value = String(value);
    }
    // Limit value length to 255 characters
    if (value.length > 255) {
      console.warn('Label value is too long, trimmed to 255 characters:', value);
      value = value.substring(0, 255);
    }
    labelString = `${key}:${value}`;
  }

  // Limit total label length to 255 characters
  if (labelString.length > 255) {
    console.warn('Label is too long, trimmed to 255 characters:', labelString);
    labelString = labelString.substring(0, 255);
  }

  services.labels.put([labelString]);
}

export default {
  artifact: saveArtifact,
  log: logMessage,
  step: addStep,
  keyValue: setKeyValue,
  label: setLabel,
};
