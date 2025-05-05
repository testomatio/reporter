import path from 'path';
import Adapter from './adapter.js';

class CSharpAdapter extends Adapter {
  formatTest(t) {
    const title = t.title.replace(/\(.*?\)/, '').trim();
    const example = t.title.match(/\((.*?)\)/);
    if (example) t.example = { ...example[1].split(',') };
    const suite = t.suite_title.split('.');
    t.suite_title = suite.pop();
    t.file = suite.join('/');
    t.title = title.trim();
    return t;
  }
}

export default CSharpAdapter;

function namespaceToFileName(fileName) {
  const fileParts = fileName.split('.');
  fileParts[fileParts.length - 1] = fileParts[fileParts.length - 1]?.replace(/\$.*/, '');
  return `${fileParts.join(path.sep)}.java`;
}
