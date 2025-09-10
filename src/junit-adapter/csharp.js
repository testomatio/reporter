import path from 'path';
import Adapter from './adapter.js';

class CSharpAdapter extends Adapter {
  formatTest(t) {
    // Don't override example if it already exists from NUnit XML processing
    // The xmlReader.js already extracts parameters correctly from <arguments>
    if (!t.example) {
      const title = t.title.replace(/\(.*?\)/, '').trim();
      const exampleMatch = t.title.match(/\((.*?)\)/);
      if (exampleMatch) {
        // Keep as array for consistency with NUnit XML processing
        t.example = exampleMatch[1].split(',').map(param => param.trim());
      }
      t.title = title.trim();
    }

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
