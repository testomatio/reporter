export const keyValueStorage: KeyValueStorage;
declare class KeyValueStorage {
    static "__#14@#instance": any;
    /**
     *
     * @returns {KeyValueStorage}
     */
    static getInstance(): KeyValueStorage;
    /**
     * Stores key-value pair and passes it to reporter
     * @param {{[key: string]: string}} keyValue - key-value pair(s) as object
     * @param {*} context - full test title
     */
    put(keyValue: {
        [key: string]: string;
    }, context?: any): void;
    /**
     * Returns key-values pairs for the test as object
     * @param {*} context testId or test context from test runner
     * @returns {{[key: string]: string} | {}} key-values pairs as object, e.g. {priority: 'high', browser: 'chrome'}
     */
    get(context?: any): {
        [key: string]: string;
    } | {};
    #private;
}
export {};
