import createDebugMessages from 'debug';
import path from 'path';
import { parseRunsUrl, setS3Credentials } from '../utils/pipe_utils.js';
import { S3Uploader } from '../uploader.js';

const debug = createDebugMessages('@testomatio/reporter:fetch');

const TESTRUNS_DEFAULT_LIMIT = 50;
const TESTRUNS_MAX_LIMIT = 100;
const TESTRUN_STATUSES = ['passed', 'failed', 'skipped', 'pending'];
const PARALLEL_REQUESTS = 5;

/**
 * Resolve the run argument of `fetch status|count|report`: a run id or a run URL.
 * A URL also sets the server and the project.
 *
 * @param {string} runArg
 * @param {{project?: string}} opts
 * @returns {{baseUrl: string, project: string, runId: string}}
 */
function resolveRunTarget(runArg, opts) {
  if (/^https?:\/\//i.test(runArg)) {
    const page = parseRunsUrl(runArg);
    if (!page?.runId) throw new Error(`Not a Testomat.io run URL: ${runArg}`);
    return { baseUrl: page.baseUrl, project: opts.project || page.project, runId: page.runId };
  }

  const project = opts.project || process.env.TESTOMATIO_PROJECT;
  if (!project) throw new Error('--project (or TESTOMATIO_PROJECT) is required');

  return { baseUrl: process.env.TESTOMATIO_URL || 'https://app.testomat.io', project, runId: runArg };
}

/**
 * Collect the statuses passed with --only and --only-failed.
 *
 * @param {{only?: string, onlyFailed?: boolean}} opts
 * @returns {string[]}
 */
function parseStatuses(opts) {
  const statuses = String(opts.only || '')
    .split(',')
    .map(status => status.trim().toLowerCase())
    .filter(Boolean);
  if (opts.onlyFailed) statuses.push('failed');

  const unknown = statuses.filter(status => !TESTRUN_STATUSES.includes(status));
  if (unknown.length) {
    throw new Error(`Unknown status: ${unknown.join(', ')}. Use one of: ${TESTRUN_STATUSES.join(', ')}`);
  }

  return [...new Set(statuses)];
}

/**
 * @param {string} [value] - Value of the CLI --limit option.
 * @returns {{limit: number, capped: boolean}}
 */
function parseTestrunsLimit(value) {
  const requested = Math.max(parseInt(value, 10) || TESTRUNS_DEFAULT_LIMIT, 1);
  return { limit: Math.min(requested, TESTRUNS_MAX_LIMIT), capped: requested > TESTRUNS_MAX_LIMIT };
}

/**
 * Run `fn` over `items` with at most `limit` calls in flight; results keep the order of `items`.
 *
 * @template T, R
 * @param {T[]} items
 * @param {number} limit
 * @param {(item: T) => Promise<R>} fn
 * @returns {Promise<R[]>}
 */
async function mapWithLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Read-only client for a single run and its testruns in API v2.
 */
class RunFetcher {
  /**
   * @param {{baseUrl: string, project: string, runId: string, apiKey: string}} params
   */
  constructor({ baseUrl, project, runId, apiKey }) {
    this.baseUrl = baseUrl;
    this.project = project;
    this.runId = runId;
    this.apiKey = apiKey;
  }

  get runUrl() {
    return new URL(`/projects/${this.project}/runs/${this.runId}`, this.baseUrl).toString();
  }

  async get(apiPath, params = []) {
    const url = new URL(`/api/v2/${this.project}${apiPath}`, this.baseUrl);
    for (const [key, value] of params) url.searchParams.append(key, value);
    debug('GET', url.toString());

    const response = await fetch(url, { headers: { Authorization: `Bearer ${this.apiKey}` } });
    const body = await response.json().catch(() => ({}));
    if (response.status === 404 && apiPath === `/runs/${this.runId}`) {
      throw new Error(`Run ${this.runId} not found in project ${this.project}`);
    }
    if (!response.ok) throw new Error(`${response.status} ${body.error || response.statusText}`);
    return body;
  }

  async fetchRun() {
    const body = await this.get(`/runs/${this.runId}`);
    return body.data;
  }

  /**
   * @param {string[]} statuses
   * @returns {string[][]}
   */
  testrunParams(statuses = []) {
    const params = [['run_id', this.runId]];
    for (const status of statuses) params.push(['filter[status][]', status]);
    return params;
  }

  /**
   * @param {string[]} [statuses]
   * @returns {Promise<number>}
   */
  async countTestruns(statuses = []) {
    const body = await this.get('/testruns', [...this.testrunParams(statuses), ['count', 'true']]);
    return body.meta?.total || 0;
  }

  /**
   * @returns {Promise<{total: number, byStatus: Record<string, number>}>}
   */
  async countTestrunsByStatus() {
    const body = await this.get('/testruns', [...this.testrunParams(), ['count', 'true'], ['group_by', 'status']]);
    return { total: body.meta?.total || 0, byStatus: body.meta?.group_by || {} };
  }

  /**
   * Testruns with failures first; the list has no stack and no artifacts.
   *
   * @param {{statuses?: string[], limit: number}} params
   * @returns {Promise<{testruns: object[], total: number}>}
   */
  async listTestruns({ statuses = [], limit }) {
    const body = await this.get('/testruns', [
      ...this.testrunParams(statuses),
      ['sort', 'failure'],
      ['order', 'desc'],
      ['per_page', String(limit)],
    ]);
    return { testruns: body.data || [], total: body.meta?.total || 0 };
  }

  /**
   * Add `stack` and `artifacts` to each testrun; a testrun that fails to load is kept as is.
   *
   * @param {object[]} testruns
   * @param {(testrun: object, err: Error) => void} onError
   */
  async addTestrunDetails(testruns, onError) {
    return mapWithLimit(testruns, PARALLEL_REQUESTS, async testrun => {
      try {
        const body = await this.get(`/testruns/${testrun.id}`);
        return { ...testrun, stack: body.data?.stack, artifacts: body.data?.artifacts || [] };
      } catch (err) {
        onError(testrun, err);
        return testrun;
      }
    });
  }

  /**
   * Shared S3 credentials of the project, returned by an empty update of the run.
   * Skipped for scheduled runs (the update launches them) and mixed runs (it marks automated tests as started).
   *
   * @param {{status?: string, kind?: string}} run
   * @returns {Promise<boolean>} whether credentials were applied
   */
  async applySharedS3Credentials(run) {
    if (run.status === 'scheduled' || run.kind === 'mixed') {
      debug(`Shared S3 credentials are not requested for a ${run.status} ${run.kind} run`);
      return false;
    }

    const url = new URL(`/api/reporter/${this.runId}`, this.baseUrl);
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: this.apiKey }),
    });
    if (!response.ok) {
      debug('Failed to get shared S3 credentials:', response.status);
      return false;
    }

    const { artifacts } = await response.json();
    if (!artifacts || !Object.keys(artifacts).length) return false;
    setS3Credentials(artifacts);
    return true;
  }
}

/**
 * Download the artifacts of each testrun to `<outDir>/<testrun id>/<file name>`.
 * Each artifact becomes `{name, href}`, where `href` is the local path relative to the current directory,
 * or the remote URL when the download failed.
 *
 * @param {object[]} testruns
 * @param {string} outDir
 * @param {(url: string, err: Error) => void} onError
 */
async function downloadArtifacts(testruns, outDir, onError) {
  const uploader = new S3Uploader();
  const jobs = [];

  // the file name is parsed inside mapWithLimit, so a malformed artifact URL only skips that artifact
  for (const testrun of testruns) {
    const usedNames = new Set();
    for (const url of testrun.artifacts || []) {
      jobs.push({ testrun, url, outDir, usedNames });
    }
  }

  const downloaded = await mapWithLimit(jobs, PARALLEL_REQUESTS, async job => {
    let name = 'artifact';
    try {
      name = decodeURIComponent(path.basename(new URL(job.url).pathname)) || 'artifact';
      if (job.usedNames.has(name)) name = `${job.usedNames.size}-${name}`;
      job.usedNames.add(name);
      const filePath = path.join(job.outDir, String(job.testrun.id), name);
      await uploader.downloadFile(job.url, filePath);
      const href = `./${path.relative(process.cwd(), filePath).split(path.sep).join('/')}`;
      return { testrun: job.testrun, href, name };
    } catch (err) {
      onError(job.url, err);
      return { testrun: job.testrun, href: job.url, name: `${name} (not downloaded)` };
    }
  });

  return testruns.map(testrun => ({
    ...testrun,
    artifacts: downloaded.filter(job => job.testrun === testrun).map(({ name, href }) => ({ name, href })),
  }));
}

/**
 * @param {{title?: string}} run
 * @param {string} runId
 * @returns {string}
 */
function defaultArtifactsDir(run, runId) {
  const slug = String(run.title || 'run')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `./${slug || 'run'}-${runId}`;
}

export {
  TESTRUNS_DEFAULT_LIMIT,
  TESTRUNS_MAX_LIMIT,
  TESTRUN_STATUSES,
  RunFetcher,
  resolveRunTarget,
  parseStatuses,
  parseTestrunsLimit,
  mapWithLimit,
  downloadArtifacts,
  defaultArtifactsDir,
};
