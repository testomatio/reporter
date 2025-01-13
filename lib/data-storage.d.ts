export const dataStorage: DataStorage;
declare class DataStorage {
    static "__#11@#instance": any;
    /**
     *
     * @returns {DataStorage}
     */
    static getInstance(): DataStorage;
    context: any;
    setContext(context: any): void;
    isFileStorage: boolean;
    /**
     * Puts any data to storage (file or global variable).
     * If file: stores data as text, if global variable – stores as array of data.
     * @param {'log' | 'artifact' | 'keyvalue'} dataType
     * @param {*} data anything you want to store (string, object, array, etc)
     * @param {*} context could be testId or any context (test name, suite name, including their IDs etc)
     * suite name + test name is used by default
     * @returns
     */
    putData(dataType: "log" | "artifact" | "keyvalue", data: any, context?: any): void;
    /**
     * Returns data, stored for specific test/context (or data which was stored without test id specified).
     * This method will get data from global variable and/or from from file (previosly saved with put method).
     *
     * @param {'log' | 'artifact' | 'keyvalue'} dataType
     * @param {string} context
     * @returns {any []} array of data (any type), null (if no data found for context) or string (if data type is log)
     */
    getData(dataType: "log" | "artifact" | "keyvalue", context: string): any[];
    #private;
}
export function stringToMD5Hash(str: any): string;
export {};
