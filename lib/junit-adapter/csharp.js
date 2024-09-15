"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const adapter_js_1 = __importDefault(require("./adapter.js"));
class CSharpAdapter extends adapter_js_1.default {
    formatTest(t) {
        const title = t.title.replace(/\(.*?\)/, '').trim();
        const example = t.title.match(/\((.*?)\)/);
        if (example)
            t.example = { ...example[1].split(',') };
        const suite = t.suite_title.split('.');
        t.suite_title = suite.pop();
        t.file = suite.join('/');
        t.title = title.trim();
        return t;
    }
}
module.exports = CSharpAdapter;
