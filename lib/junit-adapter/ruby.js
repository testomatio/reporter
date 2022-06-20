const path = require('path');
const Adapter = require('./adapter');
const fs = require('fs');

class RubyAdapter extends Adapter {

  formatStack(t) {
    const stack = super.formatStack(t);
    return stack.replace(/\[(.*?\:.\d*)\]/g, '\n$1')
  }
}

module.exports = RubyAdapter;
