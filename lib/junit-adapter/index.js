const Adapter = require('./adapter');
const JavaScriptAdapter = require('./javascript');
const JavaAdapter = require('./java');
const PythonAdapter = require('./python');
const RubyAdapter = require('./ruby');
const CSharpAdapter = require('./csharp');

function AdapterFactory(lang, opts) {
  if (lang === 'java') {
    return new JavaAdapter(opts);
  }
  if (lang === 'js') {
    return new JavaScriptAdapter(opts);
  }
  if (lang === 'python') {
    return new PythonAdapter(opts);
  }
  if (lang === 'ruby') {
    return new RubyAdapter(opts);
  }
  if (lang === 'c#' || lang === 'csharp') {
    return new CSharpAdapter(opts);
  }

  return new Adapter(opts);
}

module.exports = AdapterFactory;
