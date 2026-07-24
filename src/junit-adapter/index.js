import Adapter from './adapter.js';
import JavaScriptAdapter from './javascript.js';
import JavaAdapter from './java.js';
import PythonAdapter from './python.js';
import RubyAdapter from './ruby.js';
import CSharpAdapter from './csharp.js';
import KotlinAdapter from './kotlin.js';
import DartAdapter from './dart.js';

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
  if (lang === 'kotlin') {
    return new KotlinAdapter(opts);
  }
  if (lang === 'dart') {
    return new DartAdapter(opts);
  }

  return new Adapter(opts);
}

export default AdapterFactory;
