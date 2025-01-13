export default Adapter;
declare class Adapter {
    constructor(opts: any);
    opts: any;
    getFilePath(t: any): any;
    formatTest(t: any): any;
    formatStack(t: any): any;
    formatMessage(t: any): any;
}
