import Adapter from './adapter';
import JavaScriptAdapter from './javascript';
import JavaAdapter from './java';
import PythonAdapter from './python';
import RubyAdapter from './ruby';
import CSharpAdapter from './csharp';


export default function (lang, opts) {
  if (!lang) return new Adapter(opts);

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
}
