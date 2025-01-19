declare namespace _default {
    export { saveArtifact as artifact };
    export { logMessage as log };
    export { addStep as step };
    export { setKeyValue as keyValue };
}
export default _default;
/**
 * Stores path to file as artifact and uploads it to the S3 storage
 * @param {string | {path: string, type: string, name: string}} data - path to file or object with path, type and name
 */
declare function saveArtifact(data: string | {
    path: string;
    type: string;
    name: string;
}, context?: any): void;
/**
 * Attach log message(s) to the test report
 * @param  string
 */
declare function logMessage(...args: any[]): void;
/**
 * Similar to "log" function but marks message in report as a step
 * @param {string} message
 */
declare function addStep(message: string): void;
/**
 * Add key-value pair(s) to the test report
 * @param {{[key: string]: string} | string} keyValue object { key: value } (multiple props allowed) or key (string)
 * @param {string?} value
 */
declare function setKeyValue(keyValue: {
    [key: string]: string;
} | string, value?: string | null): void;
