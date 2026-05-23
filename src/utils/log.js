import { APP_PREFIX } from '../constants.js';

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
 * Log an info message with [TESTOMATIO] prefix.
 * Only logs when TESTOMATIO_LOG_LEVEL is INFO.
 * @param {...any} args - Arguments to log
 */
export function info(...args) {
  if (shouldLog(LOG_LEVELS.INFO)) {
    const fn = process.env.TESTOMATIO_LOG_STDERR === '1' ? console.error : console.log;
    fn(APP_PREFIX, ...args);
  }
}

/**
 * Log a warning message with [TESTOMATIO] prefix.
 * Only logs when TESTOMATIO_LOG_LEVEL is WARN or INFO.
 * @param {...any} args - Arguments to log
 */
export function warn(...args) {
  if (shouldLog(LOG_LEVELS.WARN)) {
    console.warn(APP_PREFIX, ...args);
  }
}

/**
 * Log an error message with [TESTOMATIO] prefix.
 * Logs for all TESTOMATIO_LOG_LEVEL values.
 * @param {...any} args - Arguments to log
 */
export function error(...args) {
  if (shouldLog(LOG_LEVELS.ERROR)) {
    console.error(APP_PREFIX, ...args);
  }
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
  getLogLevel,
  shouldLog,
  LOG_LEVELS,
};
