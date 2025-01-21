export class DebugPipe {
    constructor(params: any, store: any);
    params: any;
    store: any;
    isEnabled: boolean;
    batch: {
        isEnabled: any;
        intervalFunction: any;
        intervalTime: number;
        tests: any[];
        batchIndex: number;
    };
    logFilePath: string;
    testomatioEnvVars: {};
    batchUpload(): Promise<void>;
    /**
     * Logs data to a file if logging is enabled.
     *
     * @param {Object} logData - The data to be logged.
     * @returns {Promise<void>} A promise that resolves when the log data has been appended to the file.
     */
    logToFile(logData: any): Promise<void>;
    lastActionTimestamp: number;
    prepareRun(opts: any): Promise<any[]>;
    createRun(params?: {}): Promise<{}>;
    addTest(data: any): Promise<void>;
    finishRun(params: any): Promise<void>;
    toString(): string;
}
