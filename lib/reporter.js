"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.step = exports.meta = exports.logger = exports.log = exports.artifact = void 0;
// import TestomatClient from './client.js';
// import * as TRConstants from './constants.js';
const index_js_1 = require("./services/index.js");
const reporter_functions_js_1 = __importDefault(require("./reporter-functions.js"));
exports.artifact = reporter_functions_js_1.default.artifact;
exports.log = reporter_functions_js_1.default.log;
exports.logger = index_js_1.services.logger;
exports.meta = reporter_functions_js_1.default.keyValue;
exports.step = reporter_functions_js_1.default.step;
/**
 * @typedef {import('./reporter-functions.js')} artifact
 * @typedef {import('./reporter-functions.js')} log
 * @typedef {import('./services/index.js')} logger
 * @typedef {import('./reporter-functions.js')} meta
 * @typedef {import('./reporter-functions.js')} step
 */
module.exports = {
    /**
     * @deprecated Use `log` or `testomat.log`
     */
    testomatioLogger: index_js_1.services.logger,
    artifact: reporter_functions_js_1.default.artifact,
    log: reporter_functions_js_1.default.log,
    logger: index_js_1.services.logger,
    meta: reporter_functions_js_1.default.keyValue,
    step: reporter_functions_js_1.default.step,
    // TestomatClient,
    // TRConstants,
};
