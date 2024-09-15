"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const adapter_js_1 = __importDefault(require("./adapter.js"));
class RubyAdapter extends adapter_js_1.default {
    formatStack(t) {
        const stack = super.formatStack(t);
        return stack.replace(/\[(.*?:.\d*)\]/g, '\n$1');
    }
}
module.exports = RubyAdapter;
