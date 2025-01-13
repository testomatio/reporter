export default CucumberReporter;
export class CucumberReporter extends Formatter {
    constructor(options: any);
    failures: any[];
    cases: any[];
    client: TestomatClient;
    status: string;
    parseEnvelope(envelope: any): void;
    onTestCaseStarted(testCaseStarted: any): void;
    onTestCaseFinished(testCaseFinished: any): void;
    onTestRunFinished(envelope: any): void;
}
import { Formatter } from '@cucumber/cucumber';
import TestomatClient from '../../client.js';
