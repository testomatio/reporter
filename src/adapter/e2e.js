import path from 'path';
import createDebugMessages from 'debug';
import TestomatioClient from '../client.js';
import { STATUS, SCREENSHOTS_ON_STEPS } from '../constants.js';
import { getTestomatIdFromTestTitle, truncate } from '../utils/utils.js';
import { formatStep, addStatusToStep, addArtifactsToStep } from './utils/step-formatter.js';
import { log } from '../utils/log.js';

const debug = createDebugMessages('@testomatio/reporter:adapter-e2e');

/**
 * Reporter for the e2e framework (https://github.com/tester-army/e2e).
 * Add it to `reporters` in `e2e.config.ts`: `reporters: ['list', testomatio()]`.
 *
 * The config is loaded by every worker, so the client is created only inside
 * handlers, which run in the runner process.
 *
 * @param {{ apiKey?: string }} [options]
 */
export function testomatio(options = {}) {
  let client = null;
  let runPromise = null;

  function getClient() {
    if (!client) client = new TestomatioClient({ apiKey: options.apiKey });
    return client;
  }

  function startRun() {
    if (!runPromise) {
      runPromise = getClient()
        .createRun()
        .catch(err => log.error('Failed to create Testomat.io run:', err?.message || err));
    }
    return runPromise;
  }

  return {
    name: 'testomatio',

    onEvent(event) {
      try {
        if (event?.type === 'run-started') startRun();
      } catch (err) {
        debug('onEvent failed', err);
      }
    },

    async onRunFinished(run, signal) {
      const reporter = getClient();
      await startRun();

      const { report, artifactsRoot } = run;
      const groups = new Map((report.run.serialGroups || []).map(group => [group.id, group]));

      const promises = [];
      for (const result of report.run.results) {
        if (signal?.aborted) break;
        // results left out by `--last-failed` belong to the previous run
        if (result.selected === false) continue;
        const { status, data } = toTestData(result, groups, artifactsRoot);
        promises.push(reporter.addTestRun(status, data));
      }
      await Promise.all(promises);

      const duration = (Date.parse(report.run.finishedAt) - Date.parse(report.run.startedAt)) / 1000;
      await reporter.updateRunStatus(runStatus(report.run.status), { duration });

      const runUrl = reporter.pipeStore?.runUrl;
      if (runUrl) return [{ label: 'Testomat.io', text: runUrl }];
    },
  };
}

/**
 * Converts one report-1 result into Testomat.io test data.
 * Only the final attempt is reported; earlier attempts are counted as retries.
 */
export function toTestData(result, groups, artifactsRoot) {
  const attempts = attemptsOf(result, groups);
  const final = attempts.at(-1);
  const titlePath = [...result.titlePath];
  const title = titlePath.pop();

  let suiteTitle = titlePath.join(' › ');
  if (!suiteTitle) suiteTitle = path.basename(result.file);

  const meta = {
    target: result.targetId,
    platform: result.platform,
    browser: final?.environment?.browser,
  };
  if (result.agent && result.agent !== 'default') meta.agent = result.agent;
  if (result.repeat) meta.repeat = result.repeat;
  if (attempts.length > 1) meta.retryCount = attempts.length - 1;
  if (result.status === 'flaky') meta.isFlaky = true;

  const filesById = new Map();
  for (const artifact of final?.artifacts || []) {
    if (artifact.path) {
      filesById.set(artifact.id, {
        path: path.join(artifactsRoot, artifact.path),
        type: artifact.mediaType,
        title: artifact.kind,
      });
    } else if (artifact.url) {
      // hosted engines keep videos remotely
      meta[artifact.kind] = artifact.url;
    }
  }
  const files = [...filesById.values()];

  const steps = (final?.steps || []).map(step => toStep(step, filesById));

  const data = {
    rid: result.id,
    title,
    suite_title: suiteTitle,
    file: result.file,
    test_id: getTestomatIdFromTestTitle(title),
    tags: result.tags || [],
    time: final?.durationMs || 0,
    timestamp: timestampOf(final),
    error: toError(final?.error, final?.secondaryErrors),
    steps: steps.length ? steps : undefined,
    logs: logsOf(result, final),
    files: files.length ? files : undefined,
    meta,
  };

  return { status: testStatus(result.status), data };
}

/** Attempts of a result; a serial member keeps its part of the group's attempts. */
function attemptsOf(result, groups) {
  if (!result.serialGroupId) return result.attempts || [];
  const groupAttempts = groups.get(result.serialGroupId)?.attempts || [];
  return groupAttempts.map(attempt => {
    const member = attempt.members?.find(candidate => candidate.testId === result.testId);
    return {
      status: member?.status || attempt.status,
      error: member?.error || attempt.error,
      steps: member?.steps || [],
      appLog: member?.appLog || [],
      skip: member?.skip,
      durationMs: member?.durationMs,
      startedAt: member?.startedAt || attempt.startedAt,
      artifacts: attempt.artifacts || [],
      secondaryErrors: [...(member?.secondaryErrors || []), ...(attempt.secondaryErrors || [])],
      environment: attempt.environment,
    };
  });
}

function timestampOf(attempt) {
  if (!attempt?.startedAt) return undefined;
  return Date.parse(attempt.startedAt);
}

function testStatus(status) {
  if (status === 'passed' || status === 'flaky') return STATUS.PASSED;
  if (status === 'skipped') return STATUS.SKIPPED;
  // failed, timed-out, interrupted: the test reached no passing verdict
  return STATUS.FAILED;
}

function runStatus(status) {
  if (status === 'passed') return STATUS.PASSED;
  return STATUS.FAILED;
}

function toError(error, secondaryErrors = []) {
  if (!error) return undefined;
  /** @type {Error & { expected?: string, actual?: string }} */
  const err = new Error(error.message);
  err.name = error.code;
  err.stack = `${error.code}: ${error.message}\n${error.stack || sourceFrame(error.source)}`;
  if (error.details?.expected && error.details?.observed) {
    err.expected = error.details.expected;
    err.actual = error.details.observed;
  }
  for (const secondary of secondaryErrors) {
    err.stack += `\n\nAlso failed (${secondary.phase || secondary.category}) ${secondary.code}: ${secondary.message}`;
  }
  return err;
}

function sourceFrame(source) {
  if (!source) return '';
  return `    at ${source.file}:${source.line}:${source.column}`;
}

function toStep(step, filesById) {
  let category = 'user';
  if (step.phase === 'beforeEach' || step.phase === 'afterEach') category = 'hook';

  let title = step.api;
  if (step.label) title = `${step.api} ${step.label}`;

  const formatted = formatStep({
    category,
    title,
    duration: step.durationMs,
    log: stepLog(step),
  });

  let status = 'failed';
  if (step.status === 'passed') status = 'passed';
  addStatusToStep(formatted, status, step.error);

  if (step.error) {
    formatted.error = { message: truncate(`${step.error.code}: ${step.error.message}`, 250) };
  }

  if (SCREENSHOTS_ON_STEPS) {
    const screenshot = (step.artifacts || []).map(id => filesById.get(id)).find(file => file?.type === 'image/png');
    if (screenshot) addArtifactsToStep(formatted, { screenshot: screenshot.path });
  }

  return formatted;
}

/** Agent reasoning and non-binary step statuses, which a passed/failed step would lose. */
function stepLog(step) {
  const lines = [];
  if (step.status !== 'passed' && step.status !== 'failed') lines.push(`status: ${step.status}`);
  if (step.explanation) lines.push(step.explanation);
  for (const event of step.events || []) {
    if (event.reasoning) lines.push(event.reasoning);
  }
  return lines.join('\n');
}

function logsOf(result, final) {
  const lines = [];
  const skip = final?.skip || result.skip;
  if (skip) lines.push(`Skipped (${skip.cause}): ${skip.reason}`);
  if (final?.appLog?.length) {
    lines.push('App log:');
    for (const line of final.appLog) lines.push(`[${line.source}] ${line.level}: ${line.text}`);
  }
  return lines.join('\n');
}

export default testomatio;
