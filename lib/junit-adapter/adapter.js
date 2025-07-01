class Adapter {
  constructor(opts) {
    this.opts = opts;
  }

  getFilePath(t) {
    return t.file;
  }

  formatTest(t) {
    return t;
  }

  formatStack(t) {
    return t.stack || '';
  }

  formatMessage(t) {
    return t.message;
  }
}

module.exports = Adapter;
