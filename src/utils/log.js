import { APP_PREFIX } from '../constants.js';

export const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

/**
 * Get the current log level from environment variable
 * Defaults to INFO (info, warn, and error messages)
 * @returns {number} - Numeric log level
 */
export function getLogLevel() {
  const envLevel = process.env.TESTOMATIO_LOG_LEVEL?.toUpperCase();
  return LOG_LEVELS[envLevel] ?? LOG_LEVELS.INFO;
}

/**
 * Check if a message should be logged based on its level
 * A message is logged if its level is <= the current log level
 * @param {number} messageLevel - Message level
 * @returns {boolean}
 */
export function shouldLog(messageLevel) {
  return messageLevel <= getLogLevel() || !!process.env.TESTOMATIO_DEBUG;
}

/**
 * Log an info message with [TESTOMATIO] prefix
 * @param {...any} args - Arguments to log
 */
export function info(...args) {
  if (shouldLog(LOG_LEVELS.INFO)) {
    console.log(APP_PREFIX, ...args);
  }
}

/**
 * Log a warning message with [TESTOMATIO] prefix
 * @param {...any} args - Arguments to log
 */
export function warn(...args) {
  if (shouldLog(LOG_LEVELS.WARN)) {
    console.warn(APP_PREFIX, ...args);
  }
}

/**
 * Log an error message with [TESTOMATIO] prefix
 * @param {...any} args - Arguments to log
 */
export function error(...args) {
  if (shouldLog(LOG_LEVELS.ERROR)) {
    console.error(APP_PREFIX, ...args);
  }
}

/**
 * Log a debug message with [TESTOMATIO] prefix
 * @param {...any} args - Arguments to log
 */
export function debug(...args) {
  if (shouldLog(LOG_LEVELS.DEBUG)) {
    console.log(APP_PREFIX, ...args);
  }
}

/**
 * Create an object with all logging functions
 * Can be used as: import { log } from './utils/log.js';
 * log.info('message');
 */
export const log = {
  info,
  warn,
  error,
  debug,
  getLogLevel,
  shouldLog,
  LOG_LEVELS,
};
