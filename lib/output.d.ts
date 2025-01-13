export default Output;
declare class Output {
    constructor(opts?: {});
    filterFn: any;
    reset(): void;
    log: any[];
    start(): void;
    push(line: any): void;
    text(): string;
    stop(): void;
}
