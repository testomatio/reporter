import { playwrightLogsMarkers } from './adapter/utils/playwright.js';
import { isPlaywright } from './helpers.js';
import { services } from './services/index.js';
import pc from 'picocolors';

/**
 * Stores path to file as artifact and uploads it to the S3 storage
 * @param {string | {path: string, type: string, name: string}} data - path to file or object with path, type and name
 * @param {any} [context=null] - optional context parameter
 * @returns {void}
 */
function saveArtifact(data, context = null) {
  if (isPlaywright)
    console.warn(`[TESTOMATIO] 'artifact' function is not supported for Playwright. Playwright supports artifacts out of the box.`);

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
 * @param {{[key: string]: string} | string} keyValue - object { key: value } (multiple props allowed) OR key (string)
 * @param {string|undefined} [value=undefined] - optional value when keyValue is a string
 * @returns {void}
 *
 * @example
 * meta('key', 'value');
 * meta({ key: 'value' });
 * meta({ key1: 'value1', key2: 'value2' });
 */
function setKeyValue(keyValue, value = undefined) {
  // in this case keyValue acts as key (value passed as second argument)
  if (typeof keyValue === 'string') {
    const key = keyValue;
    keyValue = { [key]: value };
  }

  if (isPlaywright) {
    console.log(`${playwrightLogsMarkers.meta} ${JSON.stringify(keyValue)}`);
    return;
  }

  // in this case keyValue is expected to be an object
  services.keyValues.put(keyValue);
}

/**
 * Adds label(s) to the test
 * @param {string|string[]|{[key: string]: string}} key - just a label or object with custom field name and value
 * @param {string|null} [value=null] - optional label value (used when key is a string)
 * @returns {void}
 *
 * @example
 * label('high');
 * label('priority', 'high');
 * label({priority: 'high'});
 */
function setLabel(key, value = null) {
  let labelsArr = [];

  // process label('priority', 'high') and label('high'
  if (typeof key === 'string') {
    labelsArr = [value ? `${key}:${value}` : key];
    // process label({priority: 'high'}), label({priority: 'high', scope: 'smoke'})
  } else if (key !== null && typeof key === 'object') {
    labelsArr = Object.entries(key).map(([key, value]) => `${key}:${value}`);
  }

  const labels = labelsArr.map(l => ({ label: l }));
  if (isPlaywright) {
    console.log(`${playwrightLogsMarkers.label} ${JSON.stringify(labels)}`);
    return;
  }
  services.links.put(labels);
}

/**
 * Add link(s) to the test report
 * @param {...string | string[]} testIds - test IDs to link
 * @returns {void}
 *
 * @example
 * linkTest('T11111111', 'T22222222')
 * or
 * linkTest(['T11111111', 'T22222222'])
 */
function linkTest(...testIds) {
  const testIdsArr = testIds.flat();
  const links = testIdsArr.map(testId => ({ test: testId }));
  if (isPlaywright) {
    console.log(`${playwrightLogsMarkers.linkTest} ${JSON.stringify(links)}`);
    return;
  }
  services.links.put(links);
}

/**
 * Add JIRA issue link(s) to the test report
 * @param {...(string | string[])} jiraIds - JIRA issue IDs to link
 * @returns {void}
 *
 * @example
 * linkJira('TICKET-1', 'TICKET-2')
 * or
 * linkJira(['TICKET-1', 'TICKET-2'])
 */
function linkJira(...jiraIds) {
  const jiraIdsArr = jiraIds.flat();
  const links = jiraIdsArr.map(jiraId => ({ jira: jiraId }));
  if (isPlaywright) {
    console.log(`${playwrightLogsMarkers.linkJira} ${JSON.stringify(links)}`);
    return;
  }
  services.links.put(links);
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
