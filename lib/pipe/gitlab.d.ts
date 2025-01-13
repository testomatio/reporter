export default GitLabPipe;
export type Pipe = import("../../types/types.js").Pipe;
export type TestData = import("../../types/types.js").TestData;
/**
 * @class GitLabPipe
 * @typedef {import('../../types/types.js').Pipe} Pipe
 * @typedef {import('../../types/types.js').TestData} TestData
 */
declare class GitLabPipe {
    constructor(params: any, store?: {});
    isEnabled: boolean;
    ENV: NodeJS.ProcessEnv;
    store: {};
    tests: any[];
    token: any;
    hiddenCommentData: string;
    prepareRun(): Promise<void>;
    createRun(): Promise<void>;
    addTest(test: any): void;
    finishRun(runParams: any): Promise<void>;
    toString(): string;
    updateRun(): void;
}
