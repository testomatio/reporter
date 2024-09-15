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
exports.pipesFactory = pipesFactory;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const picocolors_1 = __importDefault(require("picocolors"));
const constants_js_1 = require("../constants.js");
const testomatio_js_1 = __importDefault(require("./testomatio.js"));
const github_js_1 = __importDefault(require("./github.js"));
const gitlab_js_1 = __importDefault(require("./gitlab.js"));
const csv_js_1 = __importDefault(require("./csv.js"));
const html_js_1 = __importDefault(require("./html.js"));
const bitbucket_js_1 = require("./bitbucket.js");
async function pipesFactory(params, opts) {
    const extraPipes = [];
    // Add extra pipes into package.json file:
    // "testomatio": {
    //   "pipes": ["my-module-pipe", "./local/js/file/pipe"]
    // }
    const packageJsonFile = path_1.default.join(process.cwd(), 'package.json');
    if (fs_1.default.existsSync(packageJsonFile)) {
        const packageJson = JSON.parse(fs_1.default.readFileSync(packageJsonFile).toString());
        const pipeDefs = packageJson?.testomatio?.pipes || [];
        for (const pipeDef of pipeDefs) {
            let PipeClass;
            try {
                PipeClass = await Promise.resolve(`${pipeDef}`).then(s => __importStar(require(s)));
            }
            catch (err) {
                console.log(constants_js_1.APP_PREFIX, `Can't load module Testomatio pipe module from ${pipeDef}`);
                continue;
            }
            try {
                extraPipes.push(new PipeClass(params, opts));
            }
            catch (err) {
                console.log(constants_js_1.APP_PREFIX, `Can't instantiate Testomatio for ${pipeDef}`, err);
                continue;
            }
        }
    }
    const pipes = [
        new testomatio_js_1.default(params, opts),
        new github_js_1.default(params, opts),
        new gitlab_js_1.default(params, opts),
        new csv_js_1.default(params, opts),
        new html_js_1.default(params, opts),
        new bitbucket_js_1.BitbucketPipe(params, opts),
        ...extraPipes,
    ];
    console.log(constants_js_1.APP_PREFIX, picocolors_1.default.cyan('Pipes:'), picocolors_1.default.cyan(pipes
        .filter(p => p.isEnabled)
        .map(p => p.toString())
        .join(', ') || 'No pipes enabled'));
    return pipes;
}

module.exports.pipesFactory = pipesFactory;
