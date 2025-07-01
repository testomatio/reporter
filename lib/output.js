const { format } = require('util');

const consoleLog = console.log;
const consoleError = console.error;

const formatArgs = args => format.apply(format, Array.prototype.slice.call(args));

class Output {
  constructor(opts = {}) {
    this.filterFn = opts.filterFn || (() => true);
    this.reset();
  }

  reset() {
    this.log = [];
    this.stop(); // resotre console log if it was overridden
  }

  start() {
    const { filterFn } = this;
    const self = this;
    console.log = (...args) => {
      const obj = {};
      Error.captureStackTrace(obj);
      const logString = formatArgs(args);
      if (filterFn(obj.stack)) {
        self.log.push(logString);
      }
      consoleLog(logString);
    };

    console.error = (...args) => {
      const obj = {};
      Error.captureStackTrace(obj);
      const logString = formatArgs(args);
      if (filterFn(obj.stack)) {
        self.log.push(logString);
      }
      consoleError(logString);
    };
  }

  push(line) {
    this.log.push(line);
  }

  text() {
    return this.log.join('\n');
  }

  stop() {
    console.log = consoleLog;
    console.error = consoleError;
  }
}

module.exports = Output;
