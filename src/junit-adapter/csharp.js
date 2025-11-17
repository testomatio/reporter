import path from 'path';
import Adapter from './adapter.js';

class CSharpAdapter extends Adapter {
  formatTest(t) {
    // Extract example from title if not already present
    if (!t.example) {
      const exampleMatch = t.title.match(/\((.*?)\)/);
      if (exampleMatch) {
        // Extract parameters as object with numeric keys for API
        const params = exampleMatch[1]
          .split(',')
          .map(param => param.trim())
          .filter(param => param !== '');
        t.example = {};
        params.forEach((param, index) => {
          t.example[index] = param;
        });
      }
    }

    // Remove parameters from title to avoid duplicates in Test Suite
    // The example field will be used for grouping on import
    t.title = t.title.replace(/\(.*?\)/, '').trim();

    const suite = t.suite_title.split('.');
    t.suite_title = suite.pop();
    t.file = namespaceToFileName(t.file);
    return t;
  }

  getFilePath(t) {
    if (!t.file) return null;

    // Normalize path separators for cross-platform compatibility
    let filePath = t.file.replace(/\\/g, '/');

    // If file already has .cs extension, use it directly
    if (filePath.endsWith('.cs')) {
      // Make relative path if it's absolute
      if (path.isAbsolute(filePath)) {
        // Try to find project-relative path
        const cwd = process.cwd().replace(/\\/g, '/');
        if (filePath.startsWith(cwd)) {
          filePath = path.relative(cwd, filePath).replace(/\\/g, '/');
        }
      }
      return filePath;
    }

    // Convert namespace path to file path
    const fileName = namespaceToFileName(filePath);
    return fileName;
  }
}

export default CSharpAdapter;

function namespaceToFileName(fileName) {
  if (!fileName) return '';

  // If already a .cs file path, clean it up
  if (fileName.endsWith('.cs')) {
    return fileName.replace(/\\/g, '/');
  }

  const fileParts = fileName.split('.');
  fileParts[fileParts.length - 1] = fileParts[fileParts.length - 1]?.replace(/\$.*/, '');
  return `${fileParts.join('/')}.cs`;
}
