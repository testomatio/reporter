"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.step = exports.meta = exports.logger = exports.log = exports.artifact = void 0;
const client_js_1 = __importDefault(require("./client.js"));
const TRConstants = __importStar(require("./constants.js"));
const index_js_1 = require("./services/index.js");
const reporter_functions_js_1 = __importDefault(require("./reporter-functions.js"));
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
    TestomatClient: client_js_1.default,
    TRConstants,
};
exports.artifact = reporter_functions_js_1.default.artifact;
exports.log = reporter_functions_js_1.default.log;
exports.logger = index_js_1.services.logger;
exports.meta = reporter_functions_js_1.default.keyValue;
exports.step = reporter_functions_js_1.default.step;
