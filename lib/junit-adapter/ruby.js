const Adapter = require('./adapter');

class RubyAdapter extends Adapter {
  formatStack(t) {
    const stack = super.formatStack(t);
    return stack.replace(/\[(.*?:.\d*)\]/g, '\n$1');
  }
}

module.exports = RubyAdapter;
