import { truncate } from '../../utils/utils.js';
import path from 'path';

/**
 * Formats a step object according to Testomat.io Step Schema
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

  if (step.screenshot) {
    formattedStep.screenshot = truncate(String(step.screenshot), 250);
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
 * Adds screenshot field to step
 * Uploads screenshot to S3 and returns URL
 */
export async function addScreenshotToStep(step, artifacts, uploader, runId, testRid) {
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
      step.screenshot = truncate(uploadResult, 250);
    }
  }

  return step;
}
