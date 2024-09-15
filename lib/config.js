"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
// This file is used to read environment variables from .env file
const debug_1 = __importDefault(require("debug"));
const debug = (0, debug_1.default)('@testomatio/reporter:config');
/* for possibility to use multiple env files (reading different paths)
const envFileVars = dotenv.config({ path: '.env' }).parsed; */
if (process.env.TESTOMATIO_API_KEY) {
    process.env.TESTOMATIO = process.env.TESTOMATIO_API_KEY;
}
if (process.env.TESTOMATIO_TOKEN) {
    process.env.TESTOMATIO = process.env.TESTOMATIO_TOKEN;
}
if (process.env.TESTOMATIO === 'undefined')
    console.error('TESTOMATIO is "undefined". Something went wrong. Contact dev team.');
// select only TESTOMATIO related variables (only to print them in debug)
const testomatioEnvVars = Object.keys(process.env)
    .filter(key => key.startsWith('TESTOMATIO') || key.startsWith('S3_'))
    .reduce((obj, key) => {
    obj[key] = process.env[key];
    return obj;
}, {}) || {};
debug('TESTOMATIO variables:', testomatioEnvVars);
// includes variables from .env file and process.env
exports.config = process.env;
