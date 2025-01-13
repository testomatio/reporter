export default CsvPipe;
export type Pipe = import("../../types/types.js").Pipe;
export type TestData = import("../../types/types.js").TestData;
/**
 * @typedef {import('../../types/types.js').Pipe} Pipe
 * @typedef {import('../../types/types.js').TestData} TestData
 * @class CsvPipe
 * @implements {Pipe}
 */
declare class CsvPipe implements Pipe {
    constructor(params: any, store: any);
    store: any;
    title: any;
    results: any[];
    outputDir: string;
    defaultReportName: string;
    csvFilename: string;
    isEnabled: boolean;
    outputFile: string;
    prepareRun(): Promise<void>;
    createRun(): Promise<void>;
    updateRun(): void;
    /**
     * Create a folder that will contain the exported files
     */
    checkExportDir(): void;
    /**
     * Save data to the csv file.
     * @param {Object} data - data that will be added to the CSV file.
     * Example: [{suite_title: "Suite #1", test: "Test-case-1", message: "Test msg"}]
     * @param {Object} headers - csv file headers. Example: [{ id: 'suite_title', title: 'Suite_title' }]
     */
    saveToCsv(data: any, headers: any): Promise<void>;
    /**
     * Add test data to the result array for saving. As a result of this function, we get a result object to save.
     * @param {Object} test - object which includes each test entry.
     */
    addTest(test: any): void;
    /**
     * @param {{ tests?: TestData[] }} runParams
     * @returns {Promise<void>}
     */
    finishRun(runParams: {
        tests?: TestData[];
    }): Promise<void>;
    toString(): string;
}
