import { isPlaywright } from './helpers.js';
import { services } from './services/index.js';

/**
 * Stores path to file as artifact and uploads it to the S3 storage
 * @param {string | {path: string, type: string, name: string}} data - path to file or object with path, type and name
 * @param {any} [context=null] - optional context parameter
 * @returns {void}
 */
function saveArtifact(data, context = null) {
  showPlaywrightWarning('artifact', 'Playwright supports artifacts out of the box.');
  if (!data) return;
  services.artifacts.put(data, context);
}

/**
 * Attach log message(s) to the test report
 * @param {...any} args - log messages to attach
 * @returns {void}
 */
function logMessage(...args) {
  services.logger._templateLiteralLog(...args);
}

/**
 * Similar to "log" function but marks message in report as a step
 * @param {string} message - step message
 * @param {{[key: string]: any}} [logs] optional key-value object with additional info, e.g. logs
 * @returns {void}
 *
 * Example:
 * step('Get response', { logs: {status: 'success'} });
 */
function addStep(message, logs) {
  // this is done because Playwright reporter intercepts console logs and then we gather them and show on Testomat
  // if not console.log, the step message will be lost from reporter
  if (isPlaywright) services.logger._templateLiteralLog(message, logs);
  // all other frameworks
  else services.logger.step(message, logs);
}

/**
 * Add key-value pair(s) to the test report
 * @param {{[key: string]: string} | string} keyValue - object { key: value } (multiple props allowed) or key (string)
 * @param {string|null} [value=null] - optional value when keyValue is a string
 * @returns {void}
 */
function setKeyValue(keyValue, value = null) {
  showPlaywrightWarning('meta', 'Use test annotations instead.');

  if (typeof keyValue === 'string') {
    keyValue = { [keyValue]: value };
  }
  services.keyValues.put(keyValue);
}

/**
 * Add a single label to the test report
 * @param {string} key - label key (e.g. 'severity', 'feature', or just 'smoke' for labels without values)
 * @param {string|null} [value=null] - optional label value (e.g. 'high', 'login')
 * @returns {void}
 */
function setLabel(key, value = null) {
  showPlaywrightWarning('label', 'Use test tag instead.');
  if (Array.isArray(value)) {
    return value.forEach(label => setLabel(key, label));
  }
  const labelObject =
    value !== null && value !== undefined && value !== '' ? { label: `${key}:${value}` } : { label: key };
  services.links.put([labelObject]);
}

/**
 * Add link(s) to the test report
 * @param {...string} testIds - test IDs to link
 * @returns {void}
 */
function linkTest(...testIds) {
  if (isPlaywright) {
    console.log(`[TESTOMATIO-LINK-TESTS] ${JSON.stringify(testIds)}`);
    return;
  }
  const links = testIds.map(testId => ({ test: testId }));
  services.links.put(links);
}

/**
 * Add JIRA issue link(s) to the test report
 * @param {...string} jiraIds - JIRA issue IDs to link
 * @returns {void}
 */
function linkJira(...jiraIds) {
  if (isPlaywright) {
    console.log(`[TESTOMATIO-LINK-JIRA] ${JSON.stringify(jiraIds)}`);
    return;
  }
  const links = jiraIds.map(jiraId => ({ jira: jiraId }));
  services.links.put(links);
}

function showPlaywrightWarning(functionName, recommendation) {
  if (isPlaywright) {
    console.warn(`[TESTOMATIO] '${functionName}' function is not supported for Playwright. ${recommendation}`);
  }
}

export default {
  artifact: saveArtifact,
  log: logMessage,
  step: addStep,
  keyValue: setKeyValue,
  label: setLabel,
  linkTest,
  linkJira,
};
