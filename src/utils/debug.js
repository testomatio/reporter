import path from 'path';
import os from 'os';
import { DEBUG_FILE } from '../constants.js';

/**
 * Get the debug file path(s).
 *
 * Always creates a timestamped file in tmp dir and a symlink in project root.
 *
 * @param {string} [suffix] - Optional suffix appended to the base name (e.g. 'replay').
 * @returns {{root: string, tmp: string}} root path (symlink), tmp path (actual file)
 */
export function getDebugFilePath(suffix = '') {
  const dateTime = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
  const baseName = suffix ? `${DEBUG_FILE}-${suffix}` : DEBUG_FILE;
  return {
    root: path.join(process.cwd(), `${baseName}.json`),
    tmp: path.join(os.tmpdir(), `${baseName}.${dateTime}.json`),
  };
}
