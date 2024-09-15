"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.services = void 0;
const logger_js_1 = require("./logger.js");
const artifacts_js_1 = require("./artifacts.js");
const key_values_js_1 = require("./key-values.js");
const data_storage_js_1 = require("../data-storage.js");
exports.services = {
    logger: logger_js_1.logger,
    artifacts: artifacts_js_1.artifactStorage,
    keyValues: key_values_js_1.keyValueStorage,
    setContext: context => {
        data_storage_js_1.dataStorage.setContext(context);
    },
};
