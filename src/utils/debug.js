import path from 'path';
import os from 'os';
import { DEBUG_FILE } from '../constants.js';

/**
 * Get the debug file path(s).
 *
 * Always creates a timestamped file in tmp dir and a symlink in project root.
 *
 * @returns {{root: string, tmp: string}} root path (symlink), tmp path (actual file)
 */
export function getDebugFilePath() {
  const dateTime = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
  return {
    root: path.join(process.cwd(), `${DEBUG_FILE}.json`),
    tmp: path.join(os.tmpdir(), `${DEBUG_FILE}.${dateTime}.json`),
  };
}
