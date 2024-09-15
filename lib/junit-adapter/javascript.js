"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const callsite_record_1 = __importDefault(require("callsite-record"));
const path_1 = __importDefault(require("path"));
const adapter_js_1 = __importDefault(require("./adapter.js"));
class JavaScriptAdapter extends adapter_js_1.default {
    formatStack(t) {
        let stack = super.formatStack(t);
        try {
            const error = new Error(stack.split('\n')[0]);
            error.stack = stack;
            const record = (0, callsite_record_1.default)({
                forError: error,
            });
            // @ts-ignore
            if (record && !record.filename.startsWith('http')) {
                stack += record.renderSync({
                    stackFilter: frame => frame.fileName?.indexOf(path_1.default.sep) > -1 &&
                        frame.fileName?.indexOf('node_modules') < 0 &&
                        frame.fileName?.indexOf('internal') < 0,
                });
            }
            return stack;
        }
        catch (err) {
            return stack;
        }
    }
}
module.exports = JavaScriptAdapter;
