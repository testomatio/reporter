export default GitHubPipe;
export type Pipe = import("../../types/types.js").Pipe;
export type TestData = import("../../types/types.js").TestData;
/**
 * @typedef {import('../../types/types.js').Pipe} Pipe
 * @typedef {import('../../types/types.js').TestData} TestData
 * @class GitHubPipe
 * @implements {Pipe}
 */
declare class GitHubPipe implements Pipe {
    constructor(params: any, store?: {});
    isEnabled: boolean;
    store: {};
    tests: any[];
    token: any;
    ref: string;
    repo: string;
    jobKey: string;
    hiddenCommentData: string;
    issue: number;
    start: Date;
    prepareRun(): Promise<void>;
    createRun(): Promise<void>;
    addTest(test: any): void;
    finishRun(runParams: any): Promise<void>;
    octokit: import("@octokit/core").Octokit & {
        paginate: import("@octokit/plugin-paginate-rest").PaginateInterface;
    } & import("@octokit/plugin-rest-endpoint-methods/dist-types/generated/method-types.js").RestEndpointMethods & import("@octokit/plugin-rest-endpoint-methods/dist-types/types.js").Api;
    toString(): string;
}
