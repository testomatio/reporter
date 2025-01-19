export default PlaywrightReporter;
declare class PlaywrightReporter {
    constructor(config?: {});
    client: TestomatioClient;
    uploads: any[];
    onBegin(config: any, suite: any): void;
    suite: any;
    config: any;
    onTestBegin(testInfo: any): void;
    onTestEnd(test: any, result: any): void;
    onEnd(result: any): Promise<void>;
    #private;
}
import TestomatioClient from '../client.js';
