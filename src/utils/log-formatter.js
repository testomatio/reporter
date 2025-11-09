import createCallsiteRecord from 'callsite-record';
import { minimatch } from 'minimatch';
import pc from 'picocolors';
import { stripVTControlCharacters } from 'util';
import { sep } from 'path';
import { formatStep, truncate } from './utils.js';

const stripColors = stripVTControlCharacters || (str => str?.replace(/\x1b\[[0-9;]*m/g, '') || '');

/**
 * Returns the formatted stack including the stack trace, steps, and logs.
 * @param {Object} params - Parameters for formatting logs
 * @param {string} params.error - Error message
 * @param {Array|any} params.steps - Test steps (array or other types)
 * @param {string} params.logs - Test logs
 * @returns {string}
 */
export function formatLogs({ error, steps, logs }) {
  error = error?.trim();
  logs = logs
    ?.trim()
    .split('\n')
    .map(l => truncate(l))
    .join('\n');

  if (Array.isArray(steps)) {
    steps = steps
      .map(step => formatStep(step))
      .flat()
      .join('\n');
  } else {
    steps = null;
  }

  let testLogs = '';
  if (steps) testLogs += `${pc.bold(pc.blue('################[ Steps ]################'))}\n${steps}\n\n`;
  if (logs) testLogs += `${pc.bold(pc.gray('################[ Logs ]################'))}\n${logs}\n\n`;
  if (error) testLogs += `${pc.bold(pc.red('################[ Failure ]################'))}\n${error}`;
  return testLogs;
}

/**
 * Formats an error with stack trace and diff information
 * @param {Error & {inspect?: () => string, operator?: string, diff?: string, actual?: any, expected?: any}} error
 *   The error object to format
 * @param {string} [message] - Optional error message override
 * @returns {string}
 */
export function formatError(error, message) {
  if (!message) message = error.message;
  // @ts-ignore - inspect is a custom property added by some testing frameworks
  if (error.inspect) message = error.inspect() || '';

  let stack = '';
  if (error.name) stack += `${pc.red(error.name)}`;
  // @ts-ignore - operator is a custom property added by assertion libraries
  if (error.operator) stack += ` (${pc.red(error.operator)})`;
  // add new line if something was added to stack
  if (stack) stack += ': ';

  stack += `${message}\n`;

  // @ts-ignore - diff is a custom property added by vitest
  if (error.diff) {
    // diff for vitest
    stack += error.diff;
    stack += '\n\n';
  } else if (error.actual && error.expected && error.actual !== error.expected) {
    // diffs for mocha, cypress, codeceptjs style
    stack += `\n\n${pc.bold(pc.green('+ expected'))} ${pc.bold(pc.red('- actual'))}`;
    stack += `\n${pc.green(`+ ${error.expected.toString().split('\n').join('\n+ ')}`)}`;
    stack += `\n${pc.red(`- ${error.actual.toString().split('\n').join('\n- ')}`)}`;
    stack += '\n\n';
  }

  const customFilter = process.env.TESTOMATIO_STACK_IGNORE;

  try {
    let hasFrame = false;
    const record = createCallsiteRecord({
      forError: error,
      isCallsiteFrame: frame => {
        if (customFilter && minimatch(frame.fileName, customFilter)) return false;
        if (hasFrame) return false;
        if (isNotInternalFrame(frame)) hasFrame = true;
        return hasFrame;
      },
    });
    // @ts-ignore
    if (record && !record.filename.startsWith('http')) {
      stack += record.renderSync({ stackFilter: isNotInternalFrame });
    }
    return stack;
  } catch (e) {
    console.log(e);
  }
}

/**
 * Checks if a stack frame is not an internal frame (node_modules or internal)
 * @param {Object} frame - Stack frame object
 * @returns {boolean}
 */
function isNotInternalFrame(frame) {
  return (
    frame.getFileName() &&
    frame.getFileName().includes(sep) &&
    !frame.getFileName().includes('node_modules') &&
    !frame.getFileName().includes('internal')
  );
}

export { stripColors };
