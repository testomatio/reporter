import createCallsiteRecord from 'callsite-record';
import path from 'path';
import Adapter from './adapter.js';

class JavaScriptAdapter extends Adapter {
  formatStack(t) {
    let stack = super.formatStack(t);

    try {
      const error = new Error(stack.split('\n')[0]);
      error.stack = stack;
      const record = createCallsiteRecord({
        forError: error,
      });
      // @ts-ignore
      if (record && !record.filename.startsWith('http')) {
        stack += record.renderSync({
          stackFilter: frame =>
            frame.fileName?.indexOf(path.sep) > -1 &&
            frame.fileName?.indexOf('node_modules') < 0 &&
            frame.fileName?.indexOf('internal') < 0,
        });
      }
      return stack;
    } catch (err) {
      return stack;
    }
  }
}

export default JavaScriptAdapter;
