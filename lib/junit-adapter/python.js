"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const adapter_js_1 = __importDefault(require("./adapter.js"));
class PythonAdapter extends adapter_js_1.default {
    getFilePath(t) {
        let fileName = namespaceToFileName(t.suite_title, { checkFile: true });
        if (!fileName)
            fileName = namespaceToFileName(t.suite_title, { checkFile: false });
        return fileName;
    }
    formatTest(t) {
        const fileParts = t.suite_title.split('.');
        const example = t.title.match(/\[(.*)\]/)?.[1];
        if (example)
            t.example = { '#': example };
        t.file = namespaceToFileName(t.suite_title);
        t.title = t.title.split('[')[0];
        t.suite_title = fileParts[fileParts.length - 1].replace(/\$/g, ' | ');
        return t;
    }
    formatMessage(t) {
        return t.message.split('&#10;')[0];
    }
}
function namespaceToFileName(fileName, opts = {}) {
    const fileParts = fileName.split('.');
    while (fileParts.length > 0) {
        const file = `${fileParts.join(path_1.default.sep)}.py`;
        if (!opts.checkFile)
            return file;
        if (fs_1.default.existsSync(`${fileParts.join(path_1.default.sep)}.py`)) {
            return file;
        }
        fileParts.pop();
    }
    return null;
}
module.exports = PythonAdapter;
