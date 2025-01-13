export default TestomatioPipe;
export type Pipe = import("../../types/types.js").Pipe;
export type TestData = import("../../types/types.js").TestData;
/**
 * @typedef {import('../../types/types.js').Pipe} Pipe
 * @typedef {import('../../types/types.js').TestData} TestData
 * @class TestomatioPipe
 * @implements {Pipe}
 */
declare class TestomatioPipe implements Pipe {
    constructor(params: any, store: any);
    batch: {
        isEnabled: any;
        intervalFunction: any;
        intervalTime: number;
        tests: any[];
        batchIndex: number;
        numberOfTimesCalledWithoutTests: number;
    };
    retriesTimestamps: any[];
    reportingCanceledDueToReqFailures: boolean;
    notReportedTestsCount: number;
    isEnabled: boolean;
    url: any;
    apiKey: any;
    parallel: any;
    store: any;
    title: any;
    sharedRun: boolean;
    sharedRunTimeout: boolean;
    groupTitle: any;
    env: string;
    label: string;
    axios: any;
    proceed: string;
    jiraId: string;
    runId: any;
    createNewTests: any;
    hasUnmatchedTests: boolean;
    requestFailures: number;
    /**
     * Asynchronously prepares and retrieves the Testomat.io test grepList based on the provided options.
     * @param {Object} opts - The options for preparing the test grepList.
     * @returns {Promise<string[]>} - An array containing the retrieved
     * test grepList, or an empty array if no tests are found or the request is disabled.
     * @throws {Error} - Throws an error if there was a problem while making the request.
     */
    prepareRun(opts: any): Promise<string[]>;
    /**
     * Creates a new run on Testomat.io
     * @param {{isBatchEnabled?: boolean}} params
     * @returns Promise<void>
     */
    createRun(params?: {
        isBatchEnabled?: boolean;
    }): Promise<void>;
    runUrl: string;
    runPublicUrl: any;
    /**
     * Adds a test to the batch uploader (or reports a single test if batch uploading is disabled)
     */
    addTest(data: any): void;
    /**
     * @param {import('../../types/types.js').RunData} params
     * @returns
     */
    finishRun(params: import("../../types/types.js").RunData): Promise<void>;
    toString(): string;
    #private;
}
