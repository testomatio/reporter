/**
 * Stores path to file as artifact and uploads it to the S3 storage
 * @param {string | {path: string, type: string, name: string}} data - path to file or object with path, type and name
 */
export function saveArtifact(data: string | {
    path: string;
    type: string;
    name: string;
}, context?: any): void;
/**
 * Attach log message(s) to the test report
 * @param  {...any} args
 */
export function logMessage(...args: any[]): void;
/**
 * Similar to "log" function but marks message in report as a step
 * @param {*} message
 */
export function addStep(message: any): void;
/**
 * Add key-value pair(s) to the test report
 * @param {*} keyValue
 */
export function setKeyValue(keyValue: any): void;
declare namespace _default {
    export { saveArtifact as artifact };
    export { logMessage as log };
    export { addStep as step };
    export { setKeyValue as keyValue };
}
export default _default;
