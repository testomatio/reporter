"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("./services/index.js");
/**
 * Stores path to file as artifact and uploads it to the S3 storage
 * @param {string | {path: string, type: string, name: string}} data - path to file or object with path, type and name
 */
function saveArtifact(data, context = null) {
    if (process.env.IS_PLAYWRIGHT)
        throw new Error(`This function is not available in Playwright framework.
    /Playwright supports artifacts out of the box`);
    if (!data)
        return;
    index_js_1.services.artifacts.put(data, context);
}
/**
 * Attach log message(s) to the test report
 * @param  string
 */
function logMessage(...args) {
    if (process.env.IS_PLAYWRIGHT)
        throw new Error('This function is not available in Playwright framework');
    index_js_1.services.logger._templateLiteralLog(...args);
}
/**
 * Similar to "log" function but marks message in report as a step
 * @param {string} message
 */
function addStep(message) {
    if (process.env.IS_PLAYWRIGHT)
        throw new Error('This function is not available in Playwright framework. Use playwright steps');
    index_js_1.services.logger.step(message);
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
    index_js_1.services.keyValues.put(keyValue);
}
module.exports = {
    artifact: saveArtifact,
    log: logMessage,
    step: addStep,
    keyValue: setKeyValue,
};
