import { format as formatArgs, stripVTControlCharacters } from 'util';
import { APP_PREFIX } from '../constants.js';

const stripColors = stripVTControlCharacters || (str => str?.replace(/\x1b\[[0-9;]*m/g, '') || '');

/**
 * Log levels for the Testomat.io reporter.
 * A message is logged if its level is <= the current log level.
 * @example
 * TESTOMATIO_LOG_LEVEL=ERROR npx codeceptjs run  // Only errors
 * TESTOMATIO_LOG_LEVEL=WARN npx codeceptjs run   // Warnings and errors
 * TESTOMATIO_LOG_LEVEL=INFO npx codeceptjs run   // Info, warnings, errors (default)
 */
export const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
};

/**
 * Get the current log level from TESTOMATIO_LOG_LEVEL environment variable.
 * Defaults to INFO (info, warn, and error messages).
 * @returns {number} Numeric log level (0-2)
 */
export function getLogLevel() {
  const envLevel = process.env.TESTOMATIO_LOG_LEVEL?.toUpperCase();
  return LOG_LEVELS[envLevel] ?? LOG_LEVELS.INFO;
}

/**
 * Check if a message should be logged based on its level.
 * A message is logged if its level is <= the current log level,
 * or if TESTOMATIO_DEBUG is set (for debugging with the debug package).
 * @param {number} messageLevel - Message level (LOG_LEVELS value)
 * @returns {boolean} True if the message should be logged
 */
export function shouldLog(messageLevel) {
  return messageLevel <= getLogLevel() || !!process.env.TESTOMATIO_DEBUG;
}

/**
 * Check if logs should be printed as JSON lines instead of [TESTOMATIO] prefixed text.
 * Enabled by the CLI for `--format json` so the whole output is machine-readable.
 * @returns {boolean}
 */
export function isJsonOutput() {
  return process.env.TESTOMATIO_LOG_JSON === '1';
}

/**
 * Render a log message as a single JSON line, e.g. `{"level":"error","message":"..."}`.
 * Colors are stripped, so the message stays readable after parsing.
 * @param {string} level - Log level name
 * @param {any[]} args - Arguments as passed to the log function
 * @param {Object} [fields] - Extra fields to add to the JSON object
 * @returns {string}
 */
function jsonLine(level, args, fields = {}) {
  const message = stripColors(formatArgs(...args)).trim();
  return JSON.stringify({ ...fields, level, message });
}

/**
 * Log an info message with [TESTOMATIO] prefix.
 * Only logs when TESTOMATIO_LOG_LEVEL is INFO.
 * @param {...any} args - Arguments to log
 */
export function info(...args) {
  if (!shouldLog(LOG_LEVELS.INFO)) return;

  let fn = console.log;
  if (process.env.TESTOMATIO_LOG_STDERR === '1') fn = console.error;

  if (isJsonOutput()) {
    fn(jsonLine('info', args));
    return;
  }
  fn(APP_PREFIX, ...args);
}

/**
 * Log a warning message with [TESTOMATIO] prefix.
 * Only logs when TESTOMATIO_LOG_LEVEL is WARN or INFO.
 * @param {...any} args - Arguments to log
 */
export function warn(...args) {
  if (!shouldLog(LOG_LEVELS.WARN)) return;

  if (isJsonOutput()) {
    console.warn(jsonLine('warn', args));
    return;
  }
  console.warn(APP_PREFIX, ...args);
}

/**
 * Log an error message with [TESTOMATIO] prefix.
 * Logs for all TESTOMATIO_LOG_LEVEL values.
 * @param {...any} args - Arguments to log
 */
export function error(...args) {
  if (!shouldLog(LOG_LEVELS.ERROR)) return;

  if (isJsonOutput()) {
    console.error(jsonLine('error', args));
    return;
  }
  console.error(APP_PREFIX, ...args);
}

/**
 * Log an error which carries structured data, e.g. a failed API request.
 * The fields are added to the JSON line; in text mode only the message is printed.
 * @param {Object} fields - Extra fields to add to the JSON object
 * @param {...any} args - Arguments to log as text
 */
export function errorWithFields(fields, ...args) {
  if (!shouldLog(LOG_LEVELS.ERROR)) return;

  if (isJsonOutput()) {
    console.error(jsonLine('error', args, fields));
    return;
  }
  console.error(APP_PREFIX, ...args);
}

/**
 * Logging utility for Testomat.io reporter.
 * All messages are prefixed with [TESTOMATIO] and respect TESTOMATIO_LOG_LEVEL.
 * @example
 * import { log } from './utils/log.js';
 * log.info('Test started');
 * log.warn('This is a warning');
 * log.error('Something went wrong');
 */
export const log = {
  info,
  warn,
  error,
  errorWithFields,
  isJsonOutput,
  getLogLevel,
  shouldLog,
  LOG_LEVELS,
};
