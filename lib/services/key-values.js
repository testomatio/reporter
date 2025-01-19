"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.keyValueStorage = void 0;
const debug_1 = __importDefault(require("debug"));
const data_storage_js_1 = require("../data-storage.js");
const debug = (0, debug_1.default)('@testomatio/reporter:services-key-value');
class KeyValueStorage {
    static #instance;
    /**
     *
     * @returns {KeyValueStorage}
     */
    static getInstance() {
        if (!this.#instance) {
            this.#instance = new KeyValueStorage();
        }
        return this.#instance;
    }
    /**
     * Stores key-value pair and passes it to reporter
     * @param {{[key: string]: string}} keyValue - key-value pair(s) as object
     * @param {*} context - full test title
     */
    put(keyValue, context = null) {
        if (!keyValue)
            return;
        data_storage_js_1.dataStorage.putData('keyvalue', keyValue, context);
    }
    #isKeyValueObject(smth) {
        return smth && typeof smth === 'object' && !Array.isArray(smth) && smth !== null;
    }
    /**
     * Returns key-values pairs for the test as object
     * @param {*} context testId or test context from test runner
     * @returns {{[key: string]: string} | {}} key-values pairs as object, e.g. {priority: 'high', browser: 'chrome'}
     */
    get(context = null) {
        const keyValuesList = data_storage_js_1.dataStorage.getData('keyvalue', context);
        if (!keyValuesList || !keyValuesList?.length)
            return {};
        const keyValues = {};
        for (const keyValue of keyValuesList) {
            if (this.#isKeyValueObject(keyValue)) {
                Object.assign(keyValues, keyValue);
            }
            else if (typeof keyValue === 'string') {
                try {
                    Object.assign(keyValues, JSON.parse(keyValue));
                }
                catch (e) {
                    debug(`Error parsing key-values for test ${context}`, keyValue);
                }
            }
        }
        return keyValues;
    }
}
exports.keyValueStorage = KeyValueStorage.getInstance();
