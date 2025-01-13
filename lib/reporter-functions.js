"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveArtifact = saveArtifact;
exports.logMessage = logMessage;
exports.addStep = addStep;
exports.setKeyValue = setKeyValue;
const index_js_1 = require("./services/index.js");
const playwright_js_1 = require("./adapter/playwright.js");
(async () => {
    if (process.env.PLAYWRIGHT_TEST_BASE_URL)
        (0, playwright_js_1.initPlaywrightForStorage)();
})();
/**
 * Stores path to file as artifact and uploads it to the S3 storage
 * @param {string | {path: string, type: string, name: string}} data - path to file or object with path, type and name
 */
function saveArtifact(data, context = null) {
    if (!data)
        return;
    index_js_1.services.artifacts.put(data, context);
}
/**
 * Attach log message(s) to the test report
 * @param  {...any} args
 */
function logMessage(...args) {
    index_js_1.services.logger._templateLiteralLog(...args);
}
/**
 * Similar to "log" function but marks message in report as a step
 * @param {*} message
 */
function addStep(message) {
    index_js_1.services.logger.step(message);
}
/**
 * Add key-value pair(s) to the test report
 * @param {*} keyValue
 */
function setKeyValue(keyValue) {
    index_js_1.services.keyValues.put(keyValue);
}
module.exports = {
    artifact: saveArtifact,
    log: logMessage,
    step: addStep,
    keyValue: setKeyValue,
};

module.exports.saveArtifact = saveArtifact;

module.exports.logMessage = logMessage;

module.exports.addStep = addStep;

module.exports.setKeyValue = setKeyValue;
