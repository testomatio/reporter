export const APP_PREFIX: string;
export const TESTOMAT_TMP_STORAGE_DIR: string;
export const CSV_HEADERS: {
    id: string;
    title: string;
}[];
export namespace STATUS {
    let PASSED: string;
    let FAILED: string;
    let SKIPPED: string;
    let FINISHED: string;
}
export namespace HTML_REPORT {
    let FOLDER: string;
    let REPORT_DEFAULT_NAME: string;
    let TEMPLATE_NAME: string;
}
export const AXIOS_TIMEOUT: number;
export const testomatLogoURL: "https://avatars.githubusercontent.com/u/59105116?s=36&v=4";
export namespace REPORTER_REQUEST_RETRIES {
    let retryTimeout: number;
    let retriesPerRequest: number;
    let maxTotalRetries: number;
    let withinTimeSeconds: number;
}
