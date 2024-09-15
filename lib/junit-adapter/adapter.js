"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Adapter {
    constructor(opts) {
        this.opts = opts;
    }
    getFilePath(t) {
        return t.file;
    }
    formatTest(t) {
        return t;
    }
    formatStack(t) {
        return t.stack || '';
    }
    formatMessage(t) {
        return t.message;
    }
}
module.exports = Adapter;
