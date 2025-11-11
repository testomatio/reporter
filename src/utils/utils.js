import { URL } from 'url';
import path, { sep, basename } from 'path';
import pc from 'picocolors';
import fs from 'fs';
import isValid from 'is-valid-path';
import createDebugMessages from 'debug';
import os from 'os';
import { fileURLToPath } from 'url';

const debug = createDebugMessages('@testomatio/reporter:util');

// Use __dirname directly since we're compiling to CommonJS
// prettier-ignore
// @ts-ignore
// eslint-disable-next-line max-len
const __dirname = typeof global.__dirname !== 'undefined' ? global.__dirname : path.dirname(fileURLToPath(import.meta.url));

/**
 * @param {String} testTitle - Test title
 *
 * @returns {String|null} testId
 */
const getTestomatIdFromTestTitle = testTitle => {
  if (!testTitle) return null;

  const captures = testTitle.match(/@T[\w\d]{8}/);

  if (captures) {
    return captures[0];
  }

  return null;
};

/**
 * @param {String} suiteTitle - suite title
 *
 * @returns {String|null} suiteId
 */
const parseSuite = suiteTitle => {
  const captures = suiteTitle.match(/@S[\w\d]{8}/);
  if (captures) {
    return captures[0];
  }

  return null;
};

/**
 * Validates TESTOMATIO_SUITE environment variable format
 * @param {String} suiteId - suite ID to validate
 * @returns {String|null} validated suite ID or null if invalid
 */
const validateSuiteId = suiteId => {
  if (!suiteId) return null;

  const match = suiteId.match(SUITE_ID_REGEX);
  return match ? match[0] : null;
};

const ansiRegExp = () => {
  const pattern = [
    '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
    '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))',
  ].join('|');

  return new RegExp(pattern, 'g');
};

const isValidUrl = s => {
  try {
    new URL(s);
    return true;
  } catch (err) {
    return false;
  }
};

const fileMatchRegex = /file:(\/*)([A-Za-z]:[\\/].*?|\/.*?)\.(png|avi|webm|jpg|html|txt)/gi;

const fetchFilesFromStackTrace = (stack = '', checkExists = true) => {
  let files = Array.from(stack.matchAll(fileMatchRegex))
    .map(match => {
      // match[0] is full match, match[1] is slashes, match[2] is path, match[3] is extension
      const slashes = match[1] || '';
      const path = match[2];
      const extension = match[3];
      return `${slashes}${path}.${extension}`;
    })
    .map(f => f.trim())
    .map(f => f.replace(/^\/+/, '/').replace(/^\/([A-Za-z]:)/, '$1')) // Remove extra slashes, handle Windows paths
    .map(f => {
      // Normalize path separators for cross-platform compatibility
      return f.replace(/\\/g, '/');
    });

  // If we're not checking file existence, remove Windows drive letters for consistency
  if (!checkExists) {
    files = files.map(f => f.replace(/^([A-Za-z]):/, ''));
  }

  debug('Found files in stack trace: ', files);

  return files.filter(f => {
    if (!checkExists) return true;
    const isFile = fs.existsSync(f);
    if (!isFile) debug('File %s could not be found and uploaded as artifact', f);
    return isFile;
  });
};

const fetchSourceCodeFromStackTrace = (stack = '') => {
  const stackLines = stack
    .split('\n')
    .filter(l => l.includes(':'))
    .map(l => l.trim())
    .map(l => {
      // Remove 'at ' prefix if present
      if (l.startsWith('at ')) {
        return l.substring(3).trim();
      }
      // Find the part that looks like a file path with line number
      const parts = l.split(' ');
      for (const part of parts) {
        // Check if this part has a colon
        if (part.includes(':')) {
          // For Windows paths, we need to handle drive letters (C:, D:, etc.)
          // Split by colon but keep drive letter with the path
          const colonParts = part.split(':');
          let filePath;

          // Check if first part is a Windows drive letter (single letter)
          if (colonParts.length >= 2 && colonParts[0].length === 1 && /[A-Za-z]/.test(colonParts[0])) {
            // Windows path like D:\path\file.php:24
            // Reconstruct as D:\path\file.php
            filePath = colonParts[0] + ':' + colonParts[1];
          } else {
            // Unix path like /path/file.php:24
            filePath = colonParts[0];
          }

          // Only consider it valid if the file exists
          if (fs.existsSync(filePath)) {
            return part;
          }
        }
      }
      // If no valid file path found in parts, return the whole line
      // It will be filtered out later if it's not a valid file path
      return parts.find(p => p.includes(':')) || l;
    })
    .filter(l => {
      // Extract file path from line (accounting for Windows drive letters)
      if (!l) return false;
      const colonParts = l.split(':');
      let filePath;

      if (colonParts.length >= 2 && colonParts[0].length === 1 && /[A-Za-z]/.test(colonParts[0])) {
        // Windows path
        filePath = colonParts[0] + ':' + colonParts[1];
      } else {
        // Unix path
        filePath = colonParts[0];
      }

      return filePath && fs.existsSync(filePath);
    })

    // // filter out 3rd party libs
    .filter(l => !l?.includes(`vendor${sep}`))
    .filter(l => !l?.includes(`node_modules${sep}`))
    .filter(l => {
      // Extract file path for final check (accounting for Windows drive letters)
      const colonParts = l.split(':');
      let filePath;

      if (colonParts.length >= 2 && colonParts[0].length === 1 && /[A-Za-z]/.test(colonParts[0])) {
        filePath = colonParts[0] + ':' + colonParts[1];
      } else {
        filePath = colonParts[0];
      }

      return fs.lstatSync(filePath).isFile();
    });

  if (!stackLines.length) return '';

  // Extract file and line number (accounting for Windows drive letters)
  const firstLine = stackLines[0];
  const colonParts = firstLine.split(':');
  let file, line;

  if (colonParts.length >= 3 && colonParts[0].length === 1 && /[A-Za-z]/.test(colonParts[0])) {
    // Windows path like D:\path\file.php:24
    file = colonParts[0] + ':' + colonParts[1];
    line = colonParts[2];
  } else {
    // Unix path like /path/file.php:24
    file = colonParts[0];
    line = colonParts[1];
  }

  const prepend = 3;
  const source = fetchSourceCode(fs.readFileSync(file).toString(), { line, prepend, limit: 7 });

  if (!source) return '';

  return source
    .split('\n')
    .map((l, i) => {
      if (i === prepend) return `${line} > ${pc.bold(l)}`;
      return `${+line - prepend + i} | ${l}`;
    })
    .join('\n');
};

export const TEST_ID_REGEX = /@T([\w\d]{8})/;
export const SUITE_ID_REGEX = /@S([\w\d]{8})/;

const fetchIdFromCode = (code, opts = {}) => {
  if (!code) return null;

  const comments = code
    .split('\n')
    .map(l => l.trim())
    .filter(l => {
      switch (opts.lang) {
        case 'ruby':
        case 'python':
          return l.startsWith('# ');
        default:
          return l.startsWith('// ');
      }
    });

  return comments.find(c => c.match(TEST_ID_REGEX))?.match(TEST_ID_REGEX)?.[1];
};

const fetchIdFromOutput = output => {
  const TID_FULL_PATTERN = new RegExp(`tid:\\/\\/.*?(${TEST_ID_REGEX.source})`);

  return output.match(TID_FULL_PATTERN)?.[2];
};

const fetchSourceCode = (contents, opts = {}) => {
  if (!opts.title && !opts.line) return '';

  // code fragment is 20 lines
  const limit = opts.limit || 50;
  let lineIndex;
  if (opts.line) lineIndex = opts.line - 1;
  const lines = contents.split('\n');

  // remove special chars from title
  if (!lineIndex && opts.title) {
    const title = opts.title.replace(/[([@].*/g, '');

    if (opts.lang === 'java') {
      lineIndex = lines.findIndex(l => l.includes(`test${title}`));
      if (lineIndex === -1) lineIndex = lines.findIndex(l => l.includes(`@DisplayName("${title}`));
      if (lineIndex === -1) lineIndex = lines.findIndex(l => l.includes(`public void ${title}`));
      if (lineIndex === -1) lineIndex = lines.findIndex(l => l.includes(`${title}(`));
    } else if (opts.lang === 'csharp') {
      // Find the method declaration line
      let methodLineIndex = lines.findIndex(l => l.includes(`public void ${title}(`));

      if (methodLineIndex === -1) {
        methodLineIndex = lines.findIndex(l => l.includes(`public async Task ${title}(`));
      }

      if (methodLineIndex === -1) {
        methodLineIndex = lines.findIndex(l => l.includes(`${title}(`));
      }

      // If found, scan upwards to find [TestCase], [Test] attributes and XML comments
      if (methodLineIndex !== -1) {
        lineIndex = methodLineIndex;

        // Scan upwards to find the start of attributes and comments
        for (let i = methodLineIndex - 1; i >= 0; i--) {
          const trimmedLine = lines[i].trim();

          // Include [TestCase], [Test], and other attributes
          if (trimmedLine.startsWith('[')) {
            lineIndex = i;
            continue;
          }

          // Include XML documentation comments
          if (trimmedLine.startsWith('///')) {
            lineIndex = i;
            continue;
          }

          // Stop at empty lines (with some tolerance)
          if (trimmedLine === '') {
            // Check if next non-empty line is an attribute or comment
            let hasMoreAttributes = false;
            for (let j = i - 1; j >= 0; j--) {
              const nextTrimmed = lines[j].trim();
              if (nextTrimmed === '') continue;
              if (nextTrimmed.startsWith('[') || nextTrimmed.startsWith('///')) {
                hasMoreAttributes = true;
                lineIndex = j;
              }
              break;
            }
            if (!hasMoreAttributes) break;
            continue;
          }

          // Stop at other method declarations or class-level elements
          if (
            trimmedLine.includes('public ') ||
            trimmedLine.includes('private ') ||
            trimmedLine.includes('protected ') ||
            trimmedLine.includes('internal ')
          ) {
            if (!trimmedLine.startsWith('[')) break;
          }
        }
      }
    } else {
      lineIndex = lines.findIndex(l => l.includes(title));
    }
  }

  if (opts.prepend) {
    lineIndex -= opts.prepend;
  }

  if (lineIndex !== -1 && lineIndex !== undefined) {
    const result = [];
    let braceDepth = 0; // Track brace depth for C# methods
    let methodStartFound = false; // Flag to indicate we've found the method opening brace

    for (let i = lineIndex; i < lineIndex + limit; i++) {
      if (lines[i] === undefined) continue;

      // Track brace depth for C# to stop after method closes
      if (opts.lang === 'csharp') {
        const line = lines[i];
        // Count opening and closing braces
        const openBraces = (line.match(/\{/g) || []).length;
        const closeBraces = (line.match(/\}/g) || []).length;

        if (openBraces > 0) methodStartFound = true;
        braceDepth += openBraces - closeBraces;

        // If we've started the method and depth returns to 0, method is complete
        if (methodStartFound && braceDepth === 0 && closeBraces > 0) {
          // Don't include the closing brace - just break
          break;
        }
      }

      if (i > lineIndex + 2 && !opts.prepend) {
        // annotation
        if (opts.lang === 'php' && lines[i].trim().startsWith('#[')) break;
        if (opts.lang === 'php' && lines[i].includes(' private function ')) break;
        if (opts.lang === 'php' && lines[i].includes(' protected function ')) break;
        if (opts.lang === 'php' && lines[i].includes(' public function ')) break;
        if (opts.lang === 'python' && lines[i].trim().match(/^@\w+/)) break;
        if (opts.lang === 'python' && lines[i].includes(' def ')) break;
        if (opts.lang === 'ruby' && lines[i].includes(' def ')) break;
        if (opts.lang === 'ruby' && lines[i].includes(' test ')) break;
        if (opts.lang === 'ruby' && lines[i].includes(' it ')) break;
        if (opts.lang === 'ruby' && lines[i].includes(' specify ')) break;
        if (opts.lang === 'ruby' && lines[i].includes(' context ')) break;
        if (opts.lang === 'ts' && lines[i].includes(' it(')) break;
        if (opts.lang === 'ts' && lines[i].includes(' test(')) break;
        if (opts.lang === 'js' && lines[i].includes(' it(')) break;
        if (opts.lang === 'js' && lines[i].includes(' test(')) break;
        if (opts.lang === 'java' && lines[i].trim().match(/^@\w+/)) break;
        if (opts.lang === 'java' && lines[i].includes(' public void ')) break;
        if (opts.lang === 'java' && lines[i].includes(' class ')) break;
        // For C#, additional checks if brace tracking didn't stop us
        if (opts.lang === 'csharp') {
          const trimmed = lines[i].trim();
          // Stop at attribute that marks beginning of next test (but not if we're still in the current method)
          if (trimmed.match(/^\[(Test|TestCase|Theory|Fact)/) && methodStartFound && braceDepth === 0) break;
          // Stop at XML documentation comments that belong to next method
          if (trimmed.startsWith('///') && methodStartFound && braceDepth === 0) break;
          // Stop at another method declaration (but not if we're still in the current method)
          if (
            trimmed.match(/^\s*(public|private|protected|internal)\s+(\w+|async\s+\w+)\s+\w+\s*\(/) &&
            methodStartFound &&
            braceDepth === 0
          )
            break;
          // Stop at class declaration
          if (trimmed.includes(' class ') && trimmed.includes('public')) break;
        }
      }

      result.push(lines[i]);
    }
    return result.join('\n');
  }
};

const isSameTest = (test, t) =>
  typeof t === 'object' &&
  typeof test === 'object' &&
  t.title === test.title &&
  t.suite_title === test.suite_title &&
  Object.values(t.example || {}) === Object.values(test.example || {}) &&
  t.test_id === test.test_id;

const getCurrentDateTime = () => {
  const today = new Date();

  return `${today.getFullYear()}_${
    today.getMonth() + 1
  }_${today.getDate()}_${today.getHours()}_${today.getMinutes()}_${today.getSeconds()}`;
};

/**
 * @param {Object} test - Test adapter object
 *
 * @returns {String|null} testInfo as one string
 */
const specificTestInfo = test => {
  // TODO: afterEach has another context.... need to add specific handler, maybe...
  if (test?.title && test?.file) {
    return `${basename(test.file).split('.').join('#')}#${test.title.split(' ').join('#')}`;
  }

  return null;
};

const fileSystem = {
  createDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      debug('Created dir: ', dirPath);
    }
  },
  clearDir(dirPath) {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true });
      debug(`Dir ${dirPath} was deleted`);
    } else {
      debug(`Trying to delete ${dirPath} but it doesn't exist`);
    }
  },
};

const foundedTestLog = (app, tests) => {
  const n = tests.length;

  return console.log(app, `✅ We found ${n === 1 ? 'one test' : `${n} tests`} in Testomat.io!`);
};

const humanize = text => {
  // if there are no spaces, decamelize
  if (!text.trim().includes(' ')) text = decamelize(text);

  return text
    .replace(/_./g, match => ` ${match.charAt(1).toUpperCase()}`)
    .trim()
    .replace(/^(.)|\s(.)/g, $1 => $1.toUpperCase())
    .trim()
    .replace(/\sA\s/g, ' a ') // replace a|the
    .replace(/\sThe\s/g, ' the ') // replace a|the
    .replace(/^Test\s/, '')
    .replace(/^Should\s/, '');
};

/**
 * From https://github.com/sindresorhus/decamelize/blob/main/index.js
 * @param {*} text
 * @returns
 */
const decamelize = text => {
  const separator = '_';
  const replacement = `$1${separator}$2`;

  // Split lowercase sequences followed by uppercase character.
  // `dataForUSACounties` → `data_For_USACounties`
  // `myURLstring → `my_URLstring`
  let decamelized = text.replace(/([\p{Lowercase_Letter}\d])(\p{Uppercase_Letter})/gu, replacement);

  // Lowercase all single uppercase characters. As we
  // want to preserve uppercase sequences, we cannot
  // simply lowercase the separated string at the end.
  // `data_For_USACounties` → `data_for_USACounties`
  decamelized = decamelized.replace(
    /((?<![\p{Uppercase_Letter}\d])[\p{Uppercase_Letter}\d](?![\p{Uppercase_Letter}\d]))/gu,
    $0 => $0.toLowerCase(),
  );

  // Remaining uppercase sequences will be separated from lowercase sequences.
  // `data_For_USACounties` → `data_for_USA_counties`
  return decamelized.replace(
    /(\p{Uppercase_Letter}+)(\p{Uppercase_Letter}\p{Lowercase_Letter}+)/gu,
    (_, $1, $2) => $1 + separator + $2.toLowerCase(),
  );
};

/**
 * Used to remove color codes
 * @param {*} input
 * @returns
 */
function removeColorCodes(input) {
  return input.replace(/\x1b\[[0-9;]*m/g, '');
}

const testRunnerHelper = {
  // for Jest
  getNameOfCurrentlyRunningTest: () => {
    if (global.testomatioTestTitle) return global.testomatioTestTitle;

    if (!process.env.JEST_WORKER_ID) return null;
    try {
      // TODO: expect?.getState()?.testPath + ' ' + expect?.getState()?.currentTestName
      // @ts-expect-error "expect" could only be defined inside Jest environement (forbidden to import it outside)
      return expect?.getState()?.currentTestName;
    } catch (e) {
      return null;
    }
  },
};

function storeRunId(runId) {
  if (!runId || runId === 'undefined') return;
  const filePath = path.join(os.tmpdir(), `testomatio.latest.run`);
  try {
    fs.writeFileSync(filePath, runId);
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    debug('Could not store latest run ID file: ', e.message);
  }
}

/**
 *
 * @returns {String|null} latest run ID
 */
function readLatestRunId() {
  try {
    const filePath = path.join(os.tmpdir(), `testomatio.latest.run`);
    if (!fs.existsSync(filePath)) return null;

    const stats = fs.statSync(filePath);
    const diff = +new Date() - +stats.mtime;
    const diffHours = diff / 1000 / 60 / 60;
    if (diffHours > 1) return null;

    return fs.readFileSync(filePath)?.toString()?.trim() ?? null;
  } catch (e) {
    return null;
  }
}

function cleanLatestRunId() {
  try {
    const filePath = path.join(os.tmpdir(), `testomatio.latest.run`);
    const runId = readLatestRunId();
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    debug(`Cleaned latest run ID (${runId}) file`, filePath);
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    console.warn('Could not clean latest run ID file: ', e);
  }
}

function formatStep(step, shift = 0) {
  const prefix = ' '.repeat(shift);

  const lines = [];

  if (step.error) {
    lines.push(`${prefix}${pc.red(step.title)} ${pc.gray(`${step.duration}ms`)}`);
  } else {
    lines.push(`${prefix}${step.title} ${pc.gray(`${step.duration}ms`)}`);
  }

  for (const child of step.steps || []) {
    lines.push(...formatStep(child, shift + 2));
  }

  return lines;
}

export function getPackageVersion() {
  const packageJsonPath = path.resolve(__dirname, '../../package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  return packageJson.version;
}

function transformEnvVarToBoolean(value) {
  if (value === undefined || value === null || value === 'undefined') return false;
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') value = String(value);
  value = value.trim();

  if (['1', 'true', 'yes', 'on'].includes(value.toLowerCase())) return true;
  if (['0', 'false', 'no', 'off'].includes(value.toLowerCase())) return false;
  // if not recognized, return truthy if any value is set
  return Boolean(value);
}

function truncate(s, size = 255) {
  if (s === undefined || s === null) {
    return '';
  }
  const str = s.toString();
  if (str.trim().length < size) {
    return str;
  }
  return `${str.substring(0, size)}...`;
}

export {
  ansiRegExp,
  truncate,
  cleanLatestRunId,
  isSameTest,
  fetchSourceCode,
  fetchSourceCodeFromStackTrace,
  fetchIdFromCode,
  fetchIdFromOutput,
  fetchFilesFromStackTrace,
  fileSystem,
  foundedTestLog,
  formatStep,
  getCurrentDateTime,
  getTestomatIdFromTestTitle,
  humanize,
  isValidUrl,
  parseSuite,
  readLatestRunId,
  removeColorCodes,
  specificTestInfo,
  storeRunId,
  testRunnerHelper,
  transformEnvVarToBoolean,
  validateSuiteId,
};
