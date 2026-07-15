import path from 'path';
import Adapter from './adapter.js';

class DartAdapter extends Adapter {
  
  getFilePath(t) {
    if (t.title.includes('[')) {
      // Android: runDartTest[tests.path.to.test Test name]
      const fileName = namespaceToFileName(t.title.split('[')[1].split(' ')[0]);
      return fileName;
    }
    // iOS: RunnerUITests tests.path.to.test Test name
    const parts = t.title.split(' ');
    const pathToken = parts.length > 1 ? parts[1] : parts[0];
    return namespaceToFileName(pathToken);
  }

  formatTest(t) {
    // Save original title for file path resolution before any transformations
    t.originalTitle = t.title;

    if (t.title.includes('[')) {
      // Android: runDartTest[<path> <name>]
      // First space is between the path and the test name; strip up to and including it, remove trailing ']'
      const spaceIndex = t.title.indexOf(' ');
      if (spaceIndex > -1) {
        t.title = t.title.slice(spaceIndex + 1).replace(/\]$/, '');
      }
    } else {
      // iOS: <ClassName> <test.path> <test name>
      // Skip both the classname token and the dot-separated test path token
      const parts = t.title.split(' ');
      if (parts.length > 2 && parts[1] && parts[1].includes('.')) {
        t.file = namespaceToFileName(parts[1]);
        t.title = parts.slice(2).join(' ');
      } else {
        const spaceIndex = t.title.indexOf(' ');
        if (spaceIndex > -1) {
          t.title = t.title.slice(spaceIndex + 1);
        }
      }
    }

    // classname: cut everything after the last dot (inclusive)
    if (t.suite_title && t.suite_title.includes('.')) {
      const lastDot = t.suite_title.lastIndexOf('.');
      t.suite_title = t.suite_title.slice(0, lastDot);
    }

    if (!t.file) {
      t.file = namespaceToFileName(t.suite_title || '');
    }

    // detect params
    const paramMatches = t.title.match(/\[(.*?)\]/g);

    if (paramMatches) {
      const params = paramMatches.map((_match, index) => `param${index + 1}`);
      if (params.length === 1) params[0] = 'param';
      let paramIndex = 0;

      t.title = t.title.replace(/: \[(.*?)\]/g, () => {
        if (params.length < 2) return `\${param}`;
        const paramName = params[paramIndex] || `param${paramIndex + 1}`;
        paramIndex++;
        return `\${${paramName}}`;
      });
      const example = {};
      paramMatches.forEach((match, index) => {
        example[params[index]] = match.replace(/[[\]]/g, '');
      });
      t.example = example;
    }

    return t;
  }
}

function namespaceToFileName(fileName) {
  let testName = fileName;

  // If it's already an extracted test name (contains dots but no runDartTest prefix)
  if (fileName.includes('.') && !fileName.startsWith('runDartTest')) {
    // Take only the first part before any spaces (the actual test path)
    testName = fileName.split(' ')[0];
  } else {
    // Legacy handling for full runDartTest[...] format
    const dartMatch = fileName.match(/runDartTest\[(.+?) /);
    if (dartMatch) {
      testName = dartMatch[1];
    } else {
      const parts = fileName.split(' ');
      if (parts.length > 1) {
        testName = parts[1];
      }
    }
  }

  const fileParts = testName.split('.');
  fileParts[fileParts.length - 1] = fileParts[fileParts.length - 1]?.replace(/\$.*/, '');
  return `${fileParts.join(path.sep)}.dart`;
}

export default DartAdapter;
