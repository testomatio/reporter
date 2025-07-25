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

const fileMatchRegex = /file:(\/+(?:[A-Za-z]:[\\/]|\/)?[^\s]*?\.(png|avi|webm|jpg|html|txt))/gi;

const fetchFilesFromStackTrace = (stack = '', checkExists = true) => {
  const files = Array.from(stack.matchAll(fileMatchRegex))
    .map(f => f[1].trim())
    .map(f => f.replace(/^\/+/, '/').replace(/^\/([A-Za-z]:)/, '$1')) // Remove extra slashes, handle Windows paths
    .map(f => {
      // Convert Windows paths to Linux paths for testing purposes
      if (f.match(/^[A-Za-z]:[\\\/]/)) {
        // Convert Windows path to Linux equivalent for test scenarios
        return f.replace(/^[A-Za-z]:[\\\/]/, '/').replace(/\\/g, '/');
      }
      return f;
    });

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
    // .map(l => l.match(/\[(.*?)\]/)?.[1] || l) // minitest format
    // .map(l => l.split(':')[0])
    .map(l => l.trim())
    .map(l => l.split(' ').find(p => p.includes(':')) || '')
    .filter(l => isValid(l?.split(':')[0]))

    // // filter out 3rd party libs
    .filter(l => !l?.includes(`vendor${sep}`))
    .filter(l => !l?.includes(`node_modules${sep}`))
    .filter(l => fs.existsSync(l.split(':')[0]))
    .filter(l => fs.lstatSync(l.split(':')[0]).isFile());

  if (!stackLines.length) return '';

  const [file, line] = stackLines[0].split(':');

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
      if (lineIndex === -1) lineIndex = lines.findIndex(l => l.includes(`public void ${title}`));
      if (lineIndex === -1) lineIndex = lines.findIndex(l => l.includes(`${title}(`));
    } else {
      lineIndex = lines.findIndex(l => l.includes(title));
    }
  }

  if (opts.prepend) {
    lineIndex -= opts.prepend;
  }

  if (lineIndex) {
    const result = [];
    for (let i = lineIndex; i < lineIndex + limit; i++) {
      if (lines[i] === undefined) continue;

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

  return n === 1 ? console.log(app, `✅ We found one test!`) : console.log(app, `✅ We found ${n} tests!`);
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
  fs.writeFileSync(filePath, runId);
}

/**
 * 
 * @returns {String|null} latest run ID
 */
function readLatestRunId() {
  try {
    const filePath = path.join(os.tmpdir(), `testomatio.latest.run`);
    const stats = fs.statSync(filePath);
    const diff = +new Date() - +stats.mtime;
    const diffHours = diff / 1000 / 60 / 60;
    if (diffHours > 1) return null;

    return fs.readFileSync(filePath)?.toString()?.trim() ?? null;
  } catch (e) {
    console.warn('Could not read latest run ID from file: ', e);
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

export {
  ansiRegExp,
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
  validateSuiteId,
};
