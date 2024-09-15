"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const adapter_js_1 = __importDefault(require("./adapter.js"));
class JavaAdapter extends adapter_js_1.default {
    getFilePath(t) {
        const fileName = namespaceToFileName(t.suite_title);
        return this.opts.javaTests + path_1.default.sep + fileName;
    }
    formatTest(t) {
        const fileParts = t.suite_title.split('.');
        t.file = namespaceToFileName(t.suite_title);
        t.title = t.title.split('(')[0];
        // detect params
        const paramMatches = t.title.match(/\[(.*?)\]/g);
        if (paramMatches) {
            const params = paramMatches.map((_match, index) => `param${index + 1}`);
            if (params.length === 1)
                params[0] = 'param';
            let paramIndex = 0;
            t.title = t.title.replace(/: \[(.*?)\]/g, () => {
                if (params.length < 2)
                    return `\${param}`;
                const paramName = params[paramIndex] || `param${paramIndex + 1}`;
                paramIndex++;
                return `\${${paramName}}`;
            });
            const example = {};
            paramMatches.forEach((match, index) => {
                example[params[index]] = match.replace(/[[\]]/g, '');
            });
            t.example = example;
        }
        t.suite_title = fileParts[fileParts.length - 1].replace(/\$/g, ' | ');
        return t;
    }
}
function namespaceToFileName(fileName) {
    const fileParts = fileName.split('.');
    fileParts[fileParts.length - 1] = fileParts[fileParts.length - 1]?.replace(/\$.*/, '');
    return `${fileParts.join(path_1.default.sep)}.java`;
}
module.exports = JavaAdapter;
