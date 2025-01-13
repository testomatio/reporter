export class JestReporter {
    constructor(globalConfig: any, options: any);
    _globalConfig: any;
    _options: any;
    client: TestomatClient;
    onRunStart(): void;
    onTestStart(testFile: any): void;
    onTestCaseStart(test: any, testCase: any): void;
    onTestResult(test: any, testResult: any): void;
    onRunComplete(contexts: any, results: any): void;
}
export default JestReporter;
import TestomatClient from '../client.js';
