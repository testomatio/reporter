export default XmlReader;
declare class XmlReader {
    constructor(opts?: {});
    requestParams: {
        apiKey: any;
        url: any;
        title: string;
        env: string;
        group_title: string;
        detach: boolean;
        isBatchEnabled: boolean;
    };
    runId: any;
    adapter: import("./junit-adapter/adapter.js").default;
    opts: {};
    store: {};
    pipesPromise: Promise<any[]>;
    parser: XMLParser;
    tests: any[];
    stats: {};
    uploader: S3Uploader;
    version: any;
    connectAdapter(): import("./junit-adapter/adapter.js").default;
    parse(fileName: any): {
        status: string;
        create_tests: boolean;
        tests_count: number;
        passed_count: number;
        skipped_count: number;
        failed_count: number;
        tests: any;
    } | {
        status: any;
        create_tests: boolean;
        tests_count: number;
        passed_count: number;
        failed_count: number;
        skipped_count: number;
        tests: any[];
    };
    processJUnit(jsonSuite: any): {
        create_tests: boolean;
        duration: number;
        failed_count: number;
        name: any;
        passed_count: number;
        skipped_count: number;
        status: string;
        tests: any[];
        tests_count: number;
    };
    processNUnit(jsonSuite: any): {
        status: any;
        create_tests: boolean;
        tests_count: number;
        passed_count: number;
        failed_count: number;
        skipped_count: number;
        tests: any[];
    };
    processTRX(jsonSuite: any): {
        status: string;
        create_tests: boolean;
        tests_count: number;
        passed_count: number;
        skipped_count: number;
        failed_count: number;
        tests: any;
    };
    processXUnit(assemblies: any): {
        status: string;
        create_tests: boolean;
        name: string;
        tests_count: number;
        passed_count: number;
        failed_count: number;
        skipped_count: number;
        tests: any[];
    };
    calculateStats(): {};
    fetchSourceCode(): void;
    formatTests(): void;
    formatErrors(): void;
    formatStack(t: any): any;
    uploadArtifacts(): Promise<void>;
    createRun(): Promise<any[]>;
    pipes: any;
    uploadData(): Promise<any[]>;
    _finishRun(): Promise<any[]>;
}
import { XMLParser } from 'fast-xml-parser';
import { S3Uploader } from './uploader.js';
