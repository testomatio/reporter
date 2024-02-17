const Adapter = require('./adapter');

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

module.exports = CSharpAdapter;
