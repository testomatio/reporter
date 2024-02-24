const createCallsiteRecord = require('callsite-record');
const path = require('path');
const Adapter = require('./adapter');

class JavaScriptAdapter extends Adapter {
  formatStack(t) {
    let stack = super.formatStack(t);

    try {
      const error = new Error(stack.split('\n')[0]);
      error.stack = stack;
      const record = createCallsiteRecord({
        forError: error,
      });
      if (record && !record.filename.startsWith('http')) {
        stack += record.renderSync({
          stackFilter: frame =>
            frame.getFileName().indexOf(path.sep) > -1 &&
            frame.getFileName().indexOf('node_modules') < 0 &&
            frame.getFileName().indexOf('internal') < 0,
        });
      }
      return stack;
    } catch (err) {
      return stack;
    }
  }
}

module.exports = JavaScriptAdapter;
