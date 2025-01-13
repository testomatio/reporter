export default Client;
export type TestData = import("../types/types.js").TestData;
export type PipeResult = import("../types/types.js").PipeResult;
/**
 * @typedef {import('../types/types.js').TestData} TestData
 * @typedef {import('../types/types.js').PipeResult} PipeResult
 */
export class Client {
    /**
     * Create a Testomat client instance
     * @returns
     */
    constructor(params?: {});
    paramsForPipesFactory: {};
    pipeStore: {};
    runId: `${string}-${string}-${string}-${string}-${string}`;
    queue: Promise<void>;
    version: any;
    executionList: Promise<void>;
    uploader: S3Uploader;
    /**
     * Asynchronously prepares the execution list for running tests through various pipes.
     * Each pipe in the client is checked for enablement,
     * and if all pipes are disabled, the function returns a resolved Promise.
     * Otherwise, it executes the `prepareRun` method for each enabled pipe and collects the results.
     * The results are then filtered to remove any undefined values.
     * If no valid results are found, the function returns undefined.
     * Otherwise, it returns the first non-empty array from the filtered results.
     *
     * @param {Object} params - The options for preparing the test execution list.
     * @param {string} params.pipe - Name of the executed pipe.
     * @param {string} params.pipeOptions - Filter option.
     * @returns {Promise<any>} - A Promise that resolves to an
     * array containing the prepared execution list,
     * or resolves to undefined if no valid results are found or if all pipes are disabled.
     */
    prepareRun(params: {
        pipe: string;
        pipeOptions: string;
    }): Promise<any>;
    pipes: any[];
    /**
     * Used to create a new Test run
     *
     * @returns {Promise<any>} - resolves to Run id which should be used to update / add test
     */
    createRun(params: any): Promise<any>;
    /**
     * Updates test status and its data
     *
     * @param {string|undefined} status
     * @param {TestData} [testData]
     * @returns {Promise<PipeResult[]>}
     */
    addTestRun(status: string | undefined, testData?: TestData): Promise<PipeResult[]>;
    /**
     *
     * Updates the status of the current test run and finishes the run.
     * @param {'passed' | 'failed' | 'skipped' | 'finished'} status - The status of the current test run.
     * Must be one of "passed", "failed", or "finished"
     * @param {boolean} [isParallel] - Whether the current test run was executed in parallel with other tests.
     * @returns {Promise<any>} - A Promise that resolves when finishes the run.
     */
    updateRunStatus(status: "passed" | "failed" | "skipped" | "finished", isParallel?: boolean): Promise<any>;
    /**
     * Returns the formatted stack including the stack trace, steps, and logs.
     * @returns {string}
     */
    formatLogs({ error, steps, logs }: {
        error: any;
        steps: any;
        logs: any;
    }): string;
    formatError(error: any, message: any): string;
}
import { S3Uploader } from './uploader.js';
