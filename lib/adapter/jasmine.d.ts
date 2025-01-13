export default JasmineReporter;
export class JasmineReporter {
    constructor(options: any);
    testTimeMap: {};
    client: TestomatClient;
    getDuration(test: any): number;
    specStarted(result: any): void;
    specDone(result: any): void;
    jasmineDone(suiteInfo: any, done: any): void;
}
import TestomatClient from '../client.js';
