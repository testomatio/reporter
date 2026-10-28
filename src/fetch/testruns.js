import createDebugMessages from 'debug';
import path from 'path';
import { parseRunsUrl, setS3Credentials } from '../utils/pipe_utils.js';
import { S3Uploader } from '../uploader.js';

const debug = createDebugMessages('@testomatio/reporter:fetch');

const TESTRUNS_DEFAULT_LIMIT = 50;
const TESTRUNS_PAGE_SIZE = 100;
const TESTRUN_STATUSES = ['passed', 'failed', 'skipped', 'pending'];
const PARALLEL_REQUESTS = 5;

/**
 * Resolve the run argument of `fetch status|count|report`: a run id or a run URL.
 * A URL also sets the server and the project; for a run id the project is resolved from the run by RunFetcher.
 *
 * @param {string} runArg
 * @returns {{baseUrl: string, project?: string, runId: string}}
 */
function resolveRunTarget(runArg) {
  if (/^https?:\/\//i.test(runArg)) {
    const page = parseRunsUrl(runArg);
    if (!page?.runId) throw new Error(`Not a Testomat.io run URL: ${runArg}`);
    return { baseUrl: page.baseUrl, project: page.project, runId: page.runId };
  }

  return { baseUrl: process.env.TESTOMATIO_URL || 'https://app.testomat.io', runId: runArg };
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
 * @param {{limit?: string, all?: boolean}} opts - Values of the CLI --limit and --all options.
 * @returns {number} Infinity for --all
 */
function parseTestrunsLimit(opts) {
  if (opts.all) return Infinity;
  return Math.max(parseInt(opts.limit, 10) || TESTRUNS_DEFAULT_LIMIT, 1);
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
   * @param {{baseUrl: string, project?: string, runId: string, apiKey: string}} params
   */
  constructor({ baseUrl, project, runId, apiKey }) {
    this.baseUrl = baseUrl;
    this.project = project;
    this.runId = runId;
    this.apiKey = apiKey;
    /** @type {Promise<any>|null} */
    this.reporterRun = null;
  }

  /**
   * Empty update of the run in the reporter API: it returns the project of the token and shared S3 credentials.
   *
   * @returns {Promise<{project?: {id: string}, artifacts?: object}>}
   */
  updateReporterRun() {
    this.reporterRun ||= (async () => {
      const url = new URL(`/api/reporter/${this.runId}`, this.baseUrl);
      debug('PUT', url.toString());
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: this.apiKey }),
      });
      const body = await response.json().catch(() => ({}));
      if (response.status === 404) throw new Error(`Run ${this.runId} not found`);
      if (!response.ok) throw new Error(`${response.status} ${body.message || body.error || response.statusText}`);
      return body;
    })();
    return this.reporterRun;
  }

  async resolveProject() {
    if (this.project) return this.project;
    const body = await this.updateReporterRun();
    if (!body.project?.id) throw new Error(`Project of run ${this.runId} is unknown`);
    this.project = body.project.id;
    return this.project;
  }

  get runUrl() {
    return new URL(`/projects/${this.project}/runs/${this.runId}`, this.baseUrl).toString();
  }

  async get(apiPath, params = []) {
    await this.resolveProject();
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
   * Testruns with failures first, read in pages of TESTRUNS_PAGE_SIZE; the list has no stack and no artifacts.
   *
   * @param {{statuses?: string[], limit: number}} params - limit is Infinity to read all testruns
   * @returns {Promise<{testruns: object[], total: number}>}
   */
  async listTestruns({ statuses = [], limit }) {
    const perPage = Math.min(limit, TESTRUNS_PAGE_SIZE);
    const getPage = async page => {
      const body = await this.get('/testruns', [
        ...this.testrunParams(statuses),
        ['sort', 'failure'],
        ['order', 'desc'],
        ['per_page', String(perPage)],
        ['page', String(page)],
      ]);
      return { testruns: body.data || [], total: body.meta?.total || 0 };
    };

    const first = await getPage(1);
    const pagesCount = Math.ceil(Math.min(limit, first.total) / perPage);
    const nextPages = Array.from({ length: Math.max(pagesCount - 1, 0) }, (_, index) => index + 2);
    const rest = await mapWithLimit(nextPages, PARALLEL_REQUESTS, getPage);

    const testruns = [first, ...rest].flatMap(page => page.testruns).slice(0, limit);
    return { testruns, total: first.total };
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
   * Unless the run was already updated to resolve its project, skipped for scheduled runs (the update launches them)
   * and mixed runs (it marks automated tests as started).
   *
   * @param {{status?: string, kind?: string}} run
   * @returns {Promise<boolean>} whether credentials were applied
   */
  async applySharedS3Credentials(run) {
    if (!this.reporterRun && (run.status === 'scheduled' || run.kind === 'mixed')) {
      debug(`Shared S3 credentials are not requested for a ${run.status} ${run.kind} run`);
      return false;
    }

    const body = await this.updateReporterRun().catch(err => {
      debug('Failed to get shared S3 credentials:', err.message);
      return { artifacts: null };
    });

    const { artifacts } = body;
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
  TESTRUNS_PAGE_SIZE,
  TESTRUN_STATUSES,
  RunFetcher,
  resolveRunTarget,
  parseStatuses,
  parseTestrunsLimit,
  mapWithLimit,
  downloadArtifacts,
  defaultArtifactsDir,
};
