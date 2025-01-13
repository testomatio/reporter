export const logger: Logger;
/**
 * Logger allows to intercept logs from any logger (console.log, tracer, pino, etc)
 * and save in the testomatio reporter.
 * Supports different syntaxes to satisfy any user preferences.
 */
declare class Logger {
    static "__#12@#instance": any;
    /**
     *
     * @returns {Logger}
     */
    static getInstance(): Logger;
    logLevel: string;
    /**
     * Allows you to define a step inside a test. Step name is attached to the report and
     * helps to understand the test flow.
     * @param {*} strings
     * @param  {...any} values
     */
    step(strings: any, ...values: any[]): void;
    /**
     *
     * @param {string} context testId or test context from test runner
     * @returns {string[]}
     */
    getLogs(context: string): string[];
    /**
     * Tagget template literal. Allows to use different syntaxes:
     * 1. Tagget template: log`text ${someVar}`
     * 2. Standard: log(`text ${someVar}`)
     * 3. Standard with multiple arguments: log('text', someVar)
     */
    _templateLiteralLog(strings: any, ...args: any[]): void;
    assert(...args: any[]): void;
    debug(...args: any[]): void;
    error(...args: any[]): void;
    info(...args: any[]): void;
    log(...args: any[]): void;
    trace(...args: any[]): void;
    warn(...args: any[]): void;
    /**
     * Intercepts user logger messages.
     * When call this method, Logger start to control the user logger
     * @param {*} userLogger
     */
    intercept(userLogger: any): void;
    stopInterception(): void;
    /**
     * Allows to configure logger. Make sure you do it before the logger usage in your code.
     *
     * @param {Object} [config={}] - The configuration object.
     * @param {string} [config.logLevel] - The desired log level. Valid values are 'DEBUG', 'INFO', 'WARN', and 'ERROR'.
     * @param {boolean} [config.prettyObjects] - Specifies whether to enable pretty printing of objects.
     * @returns {void}
     */
    configure(config?: {
        logLevel?: string;
        prettyObjects?: boolean;
    }): void;
    prettyObjects: boolean;
    #private;
}
export {};
