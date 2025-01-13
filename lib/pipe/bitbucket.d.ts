/**
 * @class BitbucketPipe
 * @typedef {import('../../types/types.js').Pipe} Pipe
 * @typedef {import('../../types/types.js').TestData} TestData
 */
export class BitbucketPipe {
    constructor(params: any, store?: {});
    isEnabled: boolean;
    ENV: NodeJS.ProcessEnv;
    store: {};
    tests: any[];
    token: any;
    hiddenCommentData: string;
    cleanLog(log: any): Promise<string>;
    prepareRun(): Promise<void>;
    createRun(): Promise<void>;
    addTest(test: any): void;
    finishRun(runParams: any): Promise<void>;
    toString(): string;
    updateRun(): void;
}
export type Pipe = import("../../types/types.js").Pipe;
export type TestData = import("../../types/types.js").TestData;
