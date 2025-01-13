export default VitestReporter;
export type VitestTest = import("../../types/types.js").VitestTest;
export type VitestTestFile = import("../../types/types.js").VitestTestFile;
export type VitestSuite = import("../../types/types.js").VitestSuite;
export type VitestTestLogs = import("../../types/types.js").VitestTestLogs;
export type ErrorWithDiff = import("../../types/vitest.types.js").ErrorWithDiff;
export type STATUS = typeof import("../constants.js").STATUS;
export type TestData = import("../../types/types.js").TestData;
/**
 * @typedef {import('../../types/types.js').VitestTest} VitestTest
 * @typedef {import('../../types/types.js').VitestTestFile} VitestTestFile
 * @typedef {import('../../types/types.js').VitestSuite} VitestSuite
 * @typedef {import('../../types/types.js').VitestTestLogs} VitestTestLogs
 * @typedef {import('../../types/vitest.types.js').ErrorWithDiff} ErrorWithDiff
 * @typedef {typeof import('../constants.js').STATUS} STATUS
 * @typedef {import('../../types/types.js').TestData} TestData
 */
export class VitestReporter {
    constructor(config?: {});
    client: TestomatioClient;
    /**
     * @type {(TestData & {status: string})[]} tests
     */
    tests: (TestData & {
        status: string;
    })[];
    onInit(): void;
    /**
     * @param {VitestTestFile[] | undefined} files // array with results;
     * @param {unknown[] | undefined} errors // errors does not contain errors from tests; probably its testrunner errors
     */
    onFinished(files: VitestTestFile[] | undefined, errors: unknown[] | undefined): Promise<void>;
    #private;
}
import { Client as TestomatioClient } from '../client.js';
