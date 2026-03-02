import { truncate } from '../../utils/utils.js';
import path from 'path';

/**
 * Formats a step object according to Testomat.io Step Schema
 *
 * This function transforms a raw step object from test frameworks (CodeceptJS, Playwright, etc.)
 * into a standardized format compatible with Testomat.io API. It ensures all text fields are
 * truncated to 250 characters as defined in testomat-api-definition.yml.
 *
 * Processed fields:
 * - category: step type (framework, user, hook) - defaults to 'user'
 * - title: step name/description, truncated to 250 chars
 * - duration: step execution time in seconds
 * - log: optional log output, truncated to 250 chars
 * - artifacts: optional array of artifact URLs (screenshots), each truncated to 250 chars
 * - error: error details (message + stack) if step failed, each truncated to 250 chars
 * - steps: recursively formats nested steps
 *
 * Schema reference: testomat-api-definition.yml (Step object)
 *
 * @param {Object} step - Raw step object from test framework
 * @param {string} [step.category] - Step category: 'user', 'framework', or 'hook'
 * @param {string} [step.title] - Step title/name
 * @param {number} [step.duration] - Step duration in seconds
 * @param {string} [step.log] - Log output for this step
 * @param {string[]} [step.artifacts] - Array of artifact URLs (screenshots)
 * @param {string|Object} [step.error] - Error details - can be string or object with message/stack
 * @param {Object[]} [step.steps] - Array of nested child steps
 * @returns {Object} Formatted step object matching Testomat.io Step Schema with:
 * category, title, duration, and optional log, artifacts, error, and steps fields
 *
 * @example
 * const rawStep = {
 *   category: 'user',
 *   title: 'I click on button',
 *   duration: 1.5,
 *   error: { message: 'Element not found', stack: 'at test.js:10:5' }
 * };
 * const formatted = formatStep(rawStep);
 * // Returns: { category: 'user', title: 'I click on button', duration: 1.5, error: {...} }
 */
export function formatStep(step) {
  const formattedStep = {
    category: step.category || 'user',
    title: truncate(String(step.title || ''), 250),
    duration: step.duration || 0,
  };

  if (step.log) {
    formattedStep.log = truncate(String(step.log), 250);
  }

  if (step.artifacts && Array.isArray(step.artifacts)) {
    formattedStep.artifacts = step.artifacts.map(artifact => truncate(String(artifact), 250));
  }

  if (step.error) {
    if (typeof step.error === 'object') {
      formattedStep.error = {
        message: truncate(String(step.error.message || 'Step failed'), 250),
        stack: truncate(String(step.error.stack || ''), 250),
      };
    } else {
      formattedStep.error = truncate(String(step.error), 250);
    }
  }

  if (step.steps && Array.isArray(step.steps)) {
    formattedStep.steps = step.steps.map(s => formatStep(s));
  }

  return formattedStep;
}

/**
 * Adds status field to step
 *
 * Normalizes step status from test frameworks to Testomat.io standard format.
 * Maps framework-specific statuses ('success', 'failed', 'passed') to Testomat.io
 * standard values ('passed', 'failed').
 *
 * Status mapping:
 * - 'success' → 'passed'
 * - 'passed' → 'passed'
 * - 'failed' → 'failed'
 * - Any other value → 'passed' (default)
 *
 * If step already has a status, it won't be overwritten. If error is provided
 * and step doesn't have status, it will be set to 'failed'.
 *
 * Schema reference: testomat-api-definition.yml (Step.status enum)
 *
 * @param {Object} step - Step object to add status to (modified in place)
 * @param {string} [step.status] - Existing status (won't be overwritten if present)
 * @param {string} status - Status from test framework: 'success', 'failed', or 'passed'
 * @param {Error|Object|null} err - Error object if step failed
 * @returns {Object} The same step object with added status field
 *
 * @example
 * const step = { title: 'Click button' };
 * addStatusToStep(step, 'success', null);
 * // step.status === 'passed'
 *
 * @example
 * const step2 = { title: 'Find element' };
 * addStatusToStep(step2, 'failed', new Error('Not found'));
 * // step2.status === 'failed'
 */
export function addStatusToStep(step, status, err) {
  if (step.status) return step;

  const statusMap = {
    'success': 'passed',
    'failed': 'failed',
    'passed': 'passed',
  };

  step.status = statusMap[status] || 'passed';

  if (err && !step.status) {
    step.status = 'failed';
  }

  return step;
}

/**
 * Adds screenshot to step as artifacts array
 *
 * Extracts screenshot path from artifacts and uploads it to S3 storage.
 * The uploaded URL is then added to the step's artifacts array.
 *
 * Artifact format supports:
 * - Array format: [{ screenshot: '/path/to/screenshot.png' }]
 * - Object format: { screenshot: '/path/to/screenshot.png' }
 *
 * Screenshot path can be specified as:
 * - Object with path property: { screenshot: { path: '/path/to/file.png' } }
 * - Object with screenshot property: { screenshot: { screenshot: '/path/to/file.png' } }
 * - Direct string path: { screenshot: '/path/to/file.png' }
 *
 * Upload path structure: [runId, testRid, 'steps', filename]
 *
 * IMPORTANT: Only uploads when S3 uploader is enabled (uploader.isEnabled === true)
 *
 * @param {Object} step - Step object to add artifacts to (modified in place)
 * @param {string[]} [step.artifacts] - Existing artifacts array (won't be overwritten if present)
 * @param {Object|Object[]|null} artifacts - Artifacts from test framework
 * @param {Object} uploader - S3 uploader instance with uploadFileByPath method
 * @param {boolean} uploader.isEnabled - Whether S3 upload is enabled
 * @param {Function} uploader.uploadFileByPath - Async function to upload file: (path, keys) => Promise<string>
 * @param {string} runId - Test run ID for upload path
 * @param {string} testRid - Test/result ID for upload path
 * @returns {Promise<Object>} The same step object with artifacts array added (max 250 chars URL)
 *
 * @example
 * const step = { title: 'Click button' };
 * const artifacts = { screenshot: '/tmp/screenshot.png' };
 * await addArtifactsToStep(step, artifacts, uploader, 'run123', 'test456');
 * // step.artifacts === ['https://s3.amazonaws.com/bucket/run123/test456/steps/screenshot.png']
 */
export async function addArtifactsToStep(step, artifacts, uploader, runId, testRid) {
  if (!artifacts) return step;

  let screenshotPath = null;

  if (Array.isArray(artifacts)) {
    const screenshotArtifact = artifacts.find(a => a.screenshot);
    if (screenshotArtifact && screenshotArtifact.path) {
      screenshotPath = screenshotArtifact.path;
    } else if (screenshotArtifact && screenshotArtifact.screenshot) {
      screenshotPath = screenshotArtifact.screenshot;
    }
  } else if (artifacts.screenshot) {
    screenshotPath = artifacts.screenshot;
  }

  if (screenshotPath && uploader && runId && testRid) {
    const filename = path.basename(screenshotPath);
    const uploadResult = await uploader.uploadFileByPath(screenshotPath, [runId, testRid, 'steps', filename]);

    if (uploadResult) {
      step.artifacts = [truncate(uploadResult, 250)];
    }
  }

  return step;
}
