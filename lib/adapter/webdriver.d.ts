export default WebdriverReporter;
declare class WebdriverReporter extends WDIOReporter {
    constructor(options: any);
    client: TestomatClient;
    _addTestPromises: any[];
    _isSynchronising: boolean;
    /**
     *
     * @param {RunnerStats} runData
     */
    onRunnerEnd(runData: RunnerStats): Promise<void>;
    onRunnerStart(): void;
    onTestStart(test: any): void;
    onTestEnd(test: any): void;
    onSuiteEnd(scerario: any): void;
    addTest(test: any): Promise<void>;
    /**
     * @param {import('../../types/types.js').WebdriverIOScenario} scenario
     */
    addBddScenario(scenario: import("../../types/types.js").WebdriverIOScenario): Promise<import("../../types/types.js").PipeResult[]>;
}
import WDIOReporter from '@wdio/reporter';
import TestomatClient from '../client.js';
import { RunnerStats } from '@wdio/reporter';
