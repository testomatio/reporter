const path = require('path');
const Adapter = require('./adapter');

class JavaAdapter extends Adapter {

  getFilePath(t) {
    const fileName = namespaceToFileName(t.suite_title)
    return this.opts.javaTests + path.sep + fileName;
  }

  formatTest(t) {
    const fileParts = t.suite_title.split('.')
    const example = t.title.match(/\[(.*)\]/)?.[1];
    if (example) t.example = { "#": example }

    t.file = namespaceToFileName(t.suite_title);
    t.title = t.title.split('(')[0];
    t.suite_title = fileParts[fileParts.length - 1].replace(/\$/g, ' | ')
    return t;
  }

  formatStack(t) {
    const stack = super.formatStack(t);

    const file = t.suite_title.split('.');

    const fileLine = `at .*${file[file.length - 1]}\.java:(\\d+)` // eslint-disable-line no-useless-escape
    const regexp = new RegExp(fileLine,"g")
    return stack.replace(regexp, `${this.opts.javaTests}${path.sep}${namespaceToFileName(t.suite_title)}:$1:`);
  }
}

function namespaceToFileName(fileName) {
    const fileParts = fileName.split('.')
    fileParts[fileParts.length - 1] = fileParts[fileParts.length - 1]?.replace(/\$.*/, '')
    return `${fileParts.join(path.sep)  }.java`;

}

module.exports = JavaAdapter;
