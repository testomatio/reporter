export function ansiRegExp(): RegExp;
export function isSameTest(test: any, t: any): boolean;
export function fetchSourceCode(contents: any, opts?: {}): string;
export function fetchSourceCodeFromStackTrace(stack?: string): string;
export function fetchIdFromCode(code: any, opts?: {}): any;
export function fetchIdFromOutput(output: any): any;
export function fetchFilesFromStackTrace(stack?: string): string[];
export namespace fileSystem {
    function createDir(dirPath: any): void;
    function clearDir(dirPath: any): void;
}
export function foundedTestLog(app: any, tests: any): void;
export function formatStep(step: any, shift?: number): any;
export function getCurrentDateTime(): string;
/**
 * @param {String} testTitle - Test title
 *
 * @returns {String|null} testId
 */
export function getTestomatIdFromTestTitle(testTitle: string): string | null;
export function humanize(text: any): any;
export function isValidUrl(s: any): boolean;
/**
 * @param {String} suiteTitle - suite title
 *
 * @returns {String|null} suiteId
 */
export function parseSuite(suiteTitle: string): string | null;
export function readLatestRunId(): string;
/**
 * Used to remove color codes
 * @param {*} input
 * @returns
 */
export function removeColorCodes(input: any): any;
/**
 * @param {Object} test - Test adapter object
 *
 * @returns {String|null} testInfo as one string
 */
export function specificTestInfo(test: any): string | null;
export function storeRunId(runId: any): void;
export namespace testRunnerHelper {
    function getNameOfCurrentlyRunningTest(): any;
}
