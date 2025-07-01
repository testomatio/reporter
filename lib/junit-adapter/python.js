const path = require('path');
const fs = require('fs');
const Adapter = require('./adapter');

class PythonAdapter extends Adapter {
  getFilePath(t) {
    let fileName = namespaceToFileName(t.suite_title, { checkFile: true });
    if (!fileName) fileName = namespaceToFileName(t.suite_title, { checkFile: false });
    return fileName;
  }

  formatTest(t) {
    const fileParts = t.suite_title.split('.');
    const example = t.title.match(/\[(.*)\]/)?.[1];
    if (example) t.example = { '#': example };

    t.file = namespaceToFileName(t.suite_title);
    t.title = t.title.split('[')[0];
    t.suite_title = fileParts[fileParts.length - 1].replace(/\$/g, ' | ');
    return t;
  }

  formatMessage(t) {
    return t.message.split('&#10;')[0];
  }
}

function namespaceToFileName(fileName, opts = {}) {
  const fileParts = fileName.split('.');

  while (fileParts.length > 0) {
    const file = `${fileParts.join(path.sep)}.py`;
    if (!opts.checkFile) return file;
    if (fs.existsSync(`${fileParts.join(path.sep)}.py`)) {
      return file;
    }
    fileParts.pop();
  }
  return null;
}

module.exports = PythonAdapter;
