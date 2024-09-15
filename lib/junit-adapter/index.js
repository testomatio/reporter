"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const adapter_js_1 = __importDefault(require("./adapter.js"));
const javascript_js_1 = __importDefault(require("./javascript.js"));
const java_js_1 = __importDefault(require("./java.js"));
const python_js_1 = __importDefault(require("./python.js"));
const ruby_js_1 = __importDefault(require("./ruby.js"));
const csharp_js_1 = __importDefault(require("./csharp.js"));
function AdapterFactory(lang, opts) {
    if (lang === 'java') {
        return new java_js_1.default(opts);
    }
    if (lang === 'js') {
        return new javascript_js_1.default(opts);
    }
    if (lang === 'python') {
        return new python_js_1.default(opts);
    }
    if (lang === 'ruby') {
        return new ruby_js_1.default(opts);
    }
    if (lang === 'c#' || lang === 'csharp') {
        return new csharp_js_1.default(opts);
    }
    return new adapter_js_1.default(opts);
}
module.exports = AdapterFactory;
