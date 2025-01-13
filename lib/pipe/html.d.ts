export default HtmlPipe;
declare class HtmlPipe {
    constructor(params: any, store?: {});
    store: {};
    title: any;
    apiKey: any;
    isHtml: string;
    isEnabled: boolean;
    htmlOutputPath: string;
    fullHtmlOutputPath: string;
    filenameMsg: string;
    tests: any[];
    htmlReportDir: string;
    htmlReportName: string;
    templateFolderPath: string;
    templateHtmlPath: string;
    createRun(): Promise<void>;
    updateRun(): void;
    /**
     * Add test data to the result array for saving. As a result of this function, we get a result object to save.
     * @param {import('../../types/types.js').RunData} test - object which includes each test entry.
     */
    addTest(test: import("../../types/types.js").RunData): void;
    finishRun(runParams: any): Promise<void>;
    /**
     * Generates an HTML report based on provided test data and a template.
     * @param {object} opts - Test options used to generate the HTML report:
     * runParams, tests, outputPath, templatePath
     * @returns {void} - This function does not return anything.
     */
    buildReport(opts: object): void;
    toString(): string;
    #private;
}
