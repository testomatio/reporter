import { expect } from 'chai';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'node:child_process';
import ServerMock from 'mock-http-server';

const host = 'localhost';
const port = 19059;
const TESTOMATIO_URL = `http://${host}:${port}`;
const PROJECT = 'demo';
const cliPath = path.resolve(process.cwd(), 'src/bin/cli.js');

function runCli(args, env = {}, cwd = process.cwd()) {
  return new Promise((resolve, reject) => {
    const childEnv = { ...process.env, TESTOMATIO: 'faketoken', TESTOMATIO_URL };
    delete childEnv.TESTOMATIO_PROJECT;
    for (const key of Object.keys(childEnv)) if (key.startsWith('S3_')) delete childEnv[key];
    Object.assign(childEnv, env);

    const child = spawn(process.execPath, [cliPath, ...args], {
      env: childEnv,
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => (stdout += d.toString()));
    child.stderr.on('data', d => (stderr += d.toString()));
    child.on('error', reject);
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
}

function replyRuns(runs, status = 200) {
  return {
    method: 'GET',
    path: `/api/v2/${PROJECT}/runs`,
    reply: {
      status,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(
        status < 400 ? { data: runs, meta: { total: runs.length } } : { error: 'Invalid or paused token' },
      ),
    },
  };
}

function replyRun(run) {
  return {
    method: 'GET',
    path: `/api/v2/${PROJECT}/runs/${run.id}`,
    reply: {
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ data: run }),
    },
  };
}

describe('cli fetch', () => {
  const server = new ServerMock({ host, port });

  before(done => server.start(done));
  after(done => server.stop(done));
  afterEach(() => server.reset());

  it('fails when --project is missing', async () => {
    const { code, stderr } = await runCli(['fetch']);

    expect(code).to.not.equal(0);
    expect(stderr).to.include('--project');
  });

  it('falls back to TESTOMATIO_PROJECT when --project is not passed', async () => {
    server.on(replyRuns([]));

    const { code } = await runCli(['fetch'], { TESTOMATIO_PROJECT: PROJECT });

    expect(code).to.equal(0);
    const [req] = server.requests({ method: 'GET', path: `/api/v2/${PROJECT}/runs` });
    expect(req).to.exist;
  });

  it('sends the auth header and maps filters to the right query params', async () => {
    server.on(replyRuns([]));

    const { code } = await runCli([
      'fetch',
      '--project', PROJECT,
      '--title', 'Nightly',
      '--tql', 'status = failed',
      '--rungroup', 'rg123',
      '--limit', '5',
    ]);

    expect(code).to.equal(0);
    const [req] = server.requests({ method: 'GET', path: `/api/v2/${PROJECT}/runs` });
    expect(req).to.exist;
    expect(req.headers.authorization).to.equal('Bearer faketoken');
    expect(req.query.search).to.equal('Nightly');
    expect(req.query.tql).to.equal('status = failed');
    expect(req.query.groupId).to.equal('rg123');
    expect(req.query.per_page).to.equal('5');
  });

  it('defaults --limit to 30 and clamps values above 100', async () => {
    server.on(replyRuns([]));
    await runCli(['fetch', '--project', PROJECT]);
    let [req] = server.requests({ method: 'GET', path: `/api/v2/${PROJECT}/runs` });
    expect(req.query.per_page).to.equal('30');

    server.reset();
    server.on(replyRuns([]));
    await runCli(['fetch', '--project', PROJECT, '--limit', '500']);
    [req] = server.requests({ method: 'GET', path: `/api/v2/${PROJECT}/runs` });
    expect(req.query.per_page).to.equal('100');
  });

  it('--latest requests per_page=1, overriding --limit', async () => {
    server.on(replyRuns([]));

    await runCli(['fetch', '--project', PROJECT, '--latest', '--limit', '50']);

    const [req] = server.requests({ method: 'GET', path: `/api/v2/${PROJECT}/runs` });
    expect(req.query.per_page).to.equal('1');
  });

  it('--latest combines with other filters instead of replacing them', async () => {
    server.on(replyRuns([]));

    await runCli(['fetch', '--project', PROJECT, '--latest', '--title', 'Nightly', '--tql', 'status = failed', '--rungroup', 'rg123']);

    const [req] = server.requests({ method: 'GET', path: `/api/v2/${PROJECT}/runs` });
    expect(req.query.per_page).to.equal('1');
    expect(req.query.search).to.equal('Nightly');
    expect(req.query.tql).to.equal('status = failed');
    expect(req.query.groupId).to.equal('rg123');
  });

  it('with --format id prints ONLY run ids, one per line', async () => {
    server.on(replyRuns([{ id: 'run1', title: 'Nightly', status: 'passed' }, { id: 'run2', title: 'Smoke', status: 'failed' }]));

    const { code, stdout } = await runCli(['fetch', '--project', PROJECT, '--format', 'id']);

    expect(code).to.equal(0);
    expect(stdout.trim()).to.equal('run1\nrun2');
  });

  it('with --format json prints all run fields', async () => {
    server.on(replyRuns([{ id: 'run1', title: 'Nightly', status: 'passed', extra: 'kept' }]));

    const { code, stdout } = await runCli(['fetch', '--project', PROJECT, '--format', 'json']);

    expect(code).to.equal(0);
    expect(JSON.parse(stdout.trim())).to.deep.equal([{ id: 'run1', title: 'Nightly', status: 'passed', extra: 'kept' }]);
  });

  it('--run fetches a single run without --project and prints it as an object with --format json', async () => {
    server.on(replyRun({ id: 'run1', title: 'Nightly', rungroup_id: 'rg123' }));
    server.on({ method: 'PUT', path: '/api/reporter/run1', reply: { status: 200, body: '{"project":{"id":"demo"}}' } });

    const { code, stdout } = await runCli(['fetch', '--run', 'run1', '--format', 'json']);

    expect(code).to.equal(0);
    expect(JSON.parse(stdout.trim())).to.deep.equal({ id: 'run1', title: 'Nightly', rungroup_id: 'rg123' });
  });

  it('takes the project and the run id from a run URL', async () => {
    server.on(replyRun({ id: 'run1', title: 'Nightly' }));

    const pageUrl = `${TESTOMATIO_URL}/projects/${PROJECT}/runs/run1?filterParam=groups%3Dtrue`;
    const { code, stdout } = await runCli(['fetch', pageUrl, '--format', 'id'], { TESTOMATIO_URL: '' });

    expect(code).to.equal(0);
    expect(stdout.trim()).to.equal('run1');
  });

  it('maps filters of a runs page URL to the API params', async () => {
    server.on(replyRuns([]));

    const filterParam = encodeURIComponent('kind=automated&user=2&status=failed&search=&groups=true');
    const pageUrl = `${TESTOMATIO_URL}/projects/${PROJECT}/runs?filterParam=${filterParam}`;
    const { code } = await runCli(['fetch', pageUrl], { TESTOMATIO_URL: '' });

    expect(code).to.equal(0);
    const [req] = server.requests({ method: 'GET', path: `/api/v2/${PROJECT}/runs` });
    expect(req.query['filter[kind]']).to.equal('automated');
    expect(req.query['filter[user]']).to.equal('2');
    expect(req.query['filter[status]']).to.equal('failed');
    expect(req.query).to.not.have.property('filter[groups]');
    expect(req.query).to.not.have.property('search');
    expect(req.query.per_page).to.equal('30');
  });

  it('exits non-zero when the URL is not a runs page', async () => {
    const { code, stderr } = await runCli(['fetch', `${TESTOMATIO_URL}/projects/${PROJECT}/suites`]);

    expect(code).to.equal(1);
    expect(stderr).to.include('Not a Testomat.io run or runs page URL');
  });

  it('exits non-zero and prints the server error when the request fails', async () => {
    server.on(replyRuns([], 401));

    const { code, stderr } = await runCli(['fetch', '--project', PROJECT]);

    expect(code).to.equal(1);
    expect(stderr).to.include('Invalid or paused token');
  });

  it('exits non-zero when TESTOMATIO is not set', async () => {
    const { code, stderr } = await runCli(['fetch', '--project', PROJECT], { TESTOMATIO: '' });

    expect(code).to.equal(1);
    expect(stderr).to.include('API key required');
  });
});

function json(body, status = 200) {
  return { status, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}

const RUN = { id: 'run1', title: 'Nightly regression', status: 'failed', kind: 'automated' };
const TESTRUNS = [
  { id: 11, test_title: 'Pay with expired card', suiteTitle: 'Checkout', status: 'failed', message: 'Card declined' },
  { id: 12, test_title: 'login.spec.js ⇒ logs in', suiteTitle: null, status: 'passed' },
];

/**
 * Mock a run with its testruns: the run, the count calls, the list and the testrun details.
 */
function mockRunWithTestruns(
  server,
  {
    run = RUN,
    testruns = TESTRUNS,
    total = testruns.length,
    details = {},
    artifacts,
    runDefects = [],
    testDefects = {},
  } = {},
) {
  server.on({
    method: 'GET',
    path: `/api/v2/${PROJECT}/defects`,
    filter: req => req.query.run_id === run.id,
    reply: json({ data: runDefects, meta: { total: runDefects.length } }),
  });
  server.on({
    method: 'GET',
    path: `/api/v2/${PROJECT}/defects`,
    filter: req => Boolean(req.query.test_id),
    reply: {
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: req => JSON.stringify({ data: testDefects[req.query.test_id] || [] }),
    },
  });
  server.on({
    method: 'PUT',
    path: `/api/reporter/${run.id}`,
    reply: json({ uid: run.id, project: { id: PROJECT, title: 'Demo' }, artifacts }),
  });
  server.on({ method: 'GET', path: `/api/v2/${PROJECT}/runs/${run.id}`, reply: json({ data: run }) });
  server.on({
    method: 'GET',
    path: `/api/v2/${PROJECT}/testruns`,
    filter: req => req.query.count === 'true' && !req.query.group_by,
    reply: json({ meta: { total } }),
  });
  server.on({
    method: 'GET',
    path: `/api/v2/${PROJECT}/testruns`,
    filter: req => req.query.count === 'true' && req.query.group_by === 'status',
    reply: json({ meta: { total, group_by: { failed: 1, passed: total - 1 } } }),
  });
  server.on({
    method: 'GET',
    path: `/api/v2/${PROJECT}/testruns`,
    filter: req => req.query.count !== 'true',
    reply: json({ data: testruns, meta: { total } }),
  });
  for (const testrun of testruns) {
    server.on({
      method: 'GET',
      path: `/api/v2/${PROJECT}/testruns/${testrun.id}`,
      reply: json({ data: { ...testrun, stack: '', artifacts: [], ...details[testrun.id] } }),
    });
  }
}

describe('cli fetch status|count|report', () => {
  const server = new ServerMock({ host, port });

  before(done => server.start(done));
  after(done => server.stop(done));
  afterEach(() => server.reset());

  it('resolves the project of a run id with one empty run update', async () => {
    mockRunWithTestruns(server);

    const { code } = await runCli(['fetch', 'status', 'run1'], { TESTOMATIO_PROJECT: 'other' });

    expect(code).to.equal(0);
    const updates = server.requests({ method: 'PUT', path: '/api/reporter/run1' });
    expect(updates).to.have.length(1);
    expect(updates[0].body).to.deep.equal({ api_key: 'faketoken' });
  });

  it('fetch report --artifacts reuses the shared credentials of the update that resolved the project', async () => {
    mockRunWithTestruns(server, { testruns: [TESTRUNS[0]], artifacts: { ACCESS_KEY_ID: 'key', BUCKET: 'bucket' } });

    const { code } = await runCli(['fetch', 'report', 'run1', '--artifacts']);

    expect(code).to.equal(0);
    expect(server.requests({ method: 'PUT', path: '/api/reporter/run1' })).to.have.length(1);
  });

  it('fetch status prints the run with testrun counts by status', async () => {
    mockRunWithTestruns(server, { total: 237 });

    const { code, stdout } = await runCli(['fetch', 'status', 'run1']);

    expect(code).to.equal(0);
    expect(stdout).to.include('run: Nightly regression');
    expect(stdout).to.include('total: 237');
    expect(stdout).to.include('failed: 1');
    expect(stdout).to.include('passed: 236');
    expect(stdout).to.include('skipped: 0');
  });

  it('fetch status --format json takes the project from a run URL', async () => {
    mockRunWithTestruns(server);

    const runUrl = `${TESTOMATIO_URL}/projects/${PROJECT}/runs/run1`;
    const { code, stdout } = await runCli(['fetch', 'status', runUrl, '--format', 'json'], { TESTOMATIO_URL: '' });

    expect(code).to.equal(0);
    expect(JSON.parse(stdout)).to.deep.equal({
      id: 'run1',
      title: 'Nightly regression',
      status: 'failed',
      url: runUrl,
      total: 2,
      passed: 1,
      failed: 1,
      skipped: 0,
      pending: 0,
    });
  });

  it('fetch count prints only the number of matching testruns', async () => {
    mockRunWithTestruns(server, { total: 12 });

    const { code, stdout } = await runCli(['fetch', 'count', 'run1', '--only-failed']);

    expect(code).to.equal(0);
    expect(stdout.trim()).to.equal('12');
    const [req] = server.requests({ method: 'GET', path: `/api/v2/${PROJECT}/testruns` });
    expect(req.query.run_id).to.equal('run1');
    expect(req.query['filter[status][]']).to.equal('failed');
    expect(req.query).to.not.have.property('group_by');
  });

  it('fetch count combines --only statuses and rejects unknown ones', async () => {
    mockRunWithTestruns(server);

    await runCli(['fetch', 'count', 'run1', '--only', 'failed,skipped']);
    const [req] = server.requests({ method: 'GET', path: `/api/v2/${PROJECT}/testruns` });
    expect(req.query['filter[status][]']).to.deep.equal(['failed', 'skipped']);

    const { code, stderr } = await runCli(['fetch', 'count', 'run1', '--only', 'broken']);
    expect(code).to.equal(1);
    expect(stderr).to.include('Unknown status: broken');
  });

  it('fetch report prints only Markdown on stdout, failures first, 50 testruns by default', async () => {
    mockRunWithTestruns(server, { total: 237 });

    const { code, stdout, stderr } = await runCli(['fetch', 'report', 'run1']);

    expect(code).to.equal(0);
    expect(stdout.startsWith('# Nightly regression — FAILED')).to.equal(true);
    expect(stdout).to.include('| Testruns | 2 of 237 shown |');
    expect(stdout).to.include('### Suite: Checkout');
    expect(stdout).to.include('#### Pay with expired card');
    expect(stdout).to.include('> Card declined');
    expect(stdout).to.include('### Suite: login.spec.js');
    expect(stdout).to.include('#### logs in');
    expect(stderr).to.include('Showing 2 of 237 testruns');

    const list = server
      .requests({ method: 'GET', path: `/api/v2/${PROJECT}/testruns` })
      .find(req => req.query.count !== 'true');
    expect(list.query.per_page).to.equal('50');
    expect(list.query.sort).to.equal('failure');
    expect(list.query.order).to.equal('desc');
    expect(server.requests({ method: 'GET', path: `/api/v2/${PROJECT}/testruns/11` })).to.have.length(0);
  });

  describe('reading testruns in chunks of 100', () => {
    const total = 250;

    beforeEach(() => {
      mockRunWithTestruns(server, { testruns: [], total });
      server.on({
        method: 'GET',
        path: `/api/v2/${PROJECT}/testruns`,
        filter: req => req.query.count !== 'true',
        reply: {
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: req => {
            const page = Number(req.query.page);
            const perPage = Number(req.query.per_page);
            const count = Math.max(Math.min(perPage, total - (page - 1) * perPage), 0);
            const testruns = Array.from({ length: count }, (_, index) => {
              const id = (page - 1) * perPage + index + 1;
              return { id, test_title: `Test ${id}`, status: 'failed' };
            });
            return JSON.stringify({ data: testruns, meta: { total } });
          },
        },
      });
    });

    const listRequests = () =>
      server
        .requests({ method: 'GET', path: `/api/v2/${PROJECT}/testruns` })
        .filter(req => req.query.count !== 'true');

    it('fetch report --all reads every page', async () => {
      const { code, stdout, stderr } = await runCli(['fetch', 'report', 'run1', '--all']);

      expect(code).to.equal(0);
      const requests = listRequests();
      expect(requests.map(req => req.query.page).sort()).to.deep.equal(['1', '2', '3']);
      expect(requests.every(req => req.query.per_page === '100')).to.equal(true);
      expect(stdout).to.include('Test 1\n');
      expect(stdout).to.include('Test 250');
      expect(stderr).to.not.include('Showing');
    });

    it('fetch report --limit above 100 reads only the pages it needs', async () => {
      const { code, stdout, stderr } = await runCli(['fetch', 'report', 'run1', '--limit', '150']);

      expect(code).to.equal(0);
      expect(listRequests().map(req => req.query.page).sort()).to.deep.equal(['1', '2']);
      expect(stdout).to.include('Test 150');
      expect(stdout).to.not.include('Test 151');
      expect(stderr).to.include('Showing 150 of 250 testruns');
    });
  });

  describe('defects', () => {
    const JIRA_DEFECT = {
      id: 'd1',
      title: 'Expired cards are accepted',
      sourceType: 'jira',
      sourceKey: 'PAY-12',
      status: 'opened',
      severity: 'high',
      url: 'https://acme.atlassian.net/browse/PAY-12',
    };
    const LINK_DEFECT = {
      id: 'd2',
      title: 'Login is slow',
      sourceType: 'link',
      sourceKey: 'login-slow',
      status: 'opened',
    };
    const testruns = [
      { ...TESTRUNS[0], testId: 'tpay', defects: [JIRA_DEFECT] },
      { ...TESTRUNS[1], testId: 'tlogin', defects: [] },
    ];

    it('fetch report links defects of the run, of each testrun and of its test case', async () => {
      mockRunWithTestruns(server, {
        testruns,
        runDefects: [JIRA_DEFECT],
        testDefects: { tpay: [JIRA_DEFECT], tlogin: [LINK_DEFECT] },
      });

      const { code, stdout } = await runCli(['fetch', 'report', 'run1']);

      expect(code).to.equal(0);
      expect(stdout).to.include('## Defects');
      expect(stdout).to.include(
        '| [PAY-12](https://acme.atlassian.net/browse/PAY-12) | Expired cards are accepted | opened | high |',
      );
      expect(stdout).to.include(
        '- [PAY-12](https://acme.atlassian.net/browse/PAY-12) Expired cards are accepted (opened, high)',
      );
      expect(stdout.match(/- \[PAY-12\]/g)).to.have.length(1);
      expect(stdout).to.include('- login-slow Login is slow (opened)');

      const testRequests = server
        .requests({ method: 'GET', path: `/api/v2/${PROJECT}/defects` })
        .filter(req => req.query.test_id);
      expect(testRequests.map(req => req.query.test_id).sort()).to.deep.equal(['tlogin', 'tpay']);
    });

    it('fetch report --no-defects requests no defects', async () => {
      mockRunWithTestruns(server, { testruns, runDefects: [JIRA_DEFECT] });

      const { code, stdout } = await runCli(['fetch', 'report', 'run1', '--no-defects']);

      expect(code).to.equal(0);
      expect(stdout).to.not.include('Defects');
      expect(server.requests({ method: 'GET', path: `/api/v2/${PROJECT}/defects` })).to.have.length(0);
    });
  });

  it('fetch report --stack adds ANSI-free stack traces from testrun details', async () => {
    mockRunWithTestruns(server, {
      details: { 11: { stack: '\u001b[31mError: Card declined\u001b[39m\n    at pay.js:1' } },
    });

    const { code, stdout } = await runCli([
      'fetch',
      'report',
      'run1',
      '--stack',
      '--only-failed',
    ]);

    expect(code).to.equal(0);
    expect(stdout).to.include('**Stack Trace**');
    expect(stdout).to.include('Error: Card declined\n    at pay.js:1');
    expect(stdout).to.not.include('\u001b[');
    expect(server.requests({ method: 'GET', path: `/api/v2/${PROJECT}/testruns/11` })).to.have.length(1);
  });

  it('fetch report --artifacts fails early without S3 access', async () => {
    mockRunWithTestruns(server);

    const { code, stderr } = await runCli(['fetch', 'report', 'run1', '--artifacts']);

    expect(code).to.equal(1);
    expect(stderr).to.include('--artifacts needs S3 access');
    expect(server.requests({ method: 'GET', path: `/api/v2/${PROJECT}/testruns` })).to.have.length(0);
  });

  it('fetch report --artifacts gets shared credentials with an empty run update', async () => {
    mockRunWithTestruns(server, { testruns: [TESTRUNS[0]] });

    await runCli(['fetch', 'report', 'run1', '--artifacts'], { S3_BUCKET: 'artifacts' });

    const [req] = server.requests({ method: 'PUT', path: '/api/reporter/run1' });
    expect(req.body).to.deep.equal({ api_key: 'faketoken' });
  });

  it('fetch report --artifacts gets shared credentials of a finished mixed run', async () => {
    mockRunWithTestruns(server, { run: { ...RUN, kind: 'mixed' } });

    const runUrl = `${TESTOMATIO_URL}/projects/${PROJECT}/runs/run1`;
    await runCli(['fetch', 'report', runUrl, '--artifacts'], { S3_BUCKET: 'artifacts', TESTOMATIO_URL: '' });

    expect(server.requests({ method: 'PUT', path: '/api/reporter/run1' })).to.have.length(1);
  });

  it('fetch report --artifacts does not update a running mixed run when the project comes from a run URL', async () => {
    mockRunWithTestruns(server, { run: { ...RUN, kind: 'mixed', status: 'running' } });

    const runUrl = `${TESTOMATIO_URL}/projects/${PROJECT}/runs/run1`;
    const { code } = await runCli(['fetch', 'report', runUrl, '--artifacts'], {
      S3_BUCKET: 'artifacts',
      TESTOMATIO_URL: '',
    });

    expect(code).to.equal(0);
    expect(server.requests({ method: 'PUT', path: '/api/reporter/run1' })).to.have.length(0);
  });

  it('fetch report --artifacts downloads artifacts and links the local files', async () => {
    const artifactUrl = `${TESTOMATIO_URL}/files/run1/screenshot.png`;
    mockRunWithTestruns(server, { testruns: [TESTRUNS[0]], details: { 11: { artifacts: [artifactUrl] } } });
    server.on({ method: 'GET', path: '/files/run1/screenshot.png', reply: { status: 200, body: 'png-bytes' } });
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'fetch-report-'));

    const { code, stdout } = await runCli(
      ['fetch', 'report', 'run1', '--artifacts', '--out', 'evidence'],
      { S3_BUCKET: 'artifacts' },
      cwd,
    );

    expect(code).to.equal(0);
    expect(fs.readFileSync(path.join(cwd, 'evidence', '11', 'screenshot.png'), 'utf8')).to.equal('png-bytes');
    expect(stdout).to.include('![screenshot.png](./evidence/11/screenshot.png)');
    expect(stdout).to.not.include('**Stack Trace**');
  });

  it('fetch report --artifacts skips a malformed artifact URL instead of crashing', async () => {
    const artifactUrl = `${TESTOMATIO_URL}/files/run1/screenshot.png`;
    mockRunWithTestruns(server, {
      testruns: [TESTRUNS[0]],
      details: { 11: { artifacts: ['not a url', artifactUrl] } },
    });
    server.on({ method: 'GET', path: '/files/run1/screenshot.png', reply: { status: 200, body: 'png-bytes' } });
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'fetch-report-'));

    const { code, stdout, stderr } = await runCli(
      ['fetch', 'report', 'run1', '--artifacts', '--out', 'evidence'],
      { S3_BUCKET: 'artifacts' },
      cwd,
    );

    expect(code).to.equal(0);
    expect(stdout).to.include('![screenshot.png](./evidence/11/screenshot.png)');
    expect(stdout).to.include('not a url');
    expect(stdout).to.include('(not downloaded)');
    expect(stderr).to.include('Failed to download not a url');
  });

  it('fetch report exits non-zero when the run does not exist', async () => {
    server.on({ method: 'GET', path: `/api/v2/${PROJECT}/runs/missing`, reply: json({ error: 'Not found' }, 404) });

    const { code, stderr } = await runCli(['fetch', 'report', 'missing']);

    expect(code).to.equal(1);
    expect(stderr).to.include('Run missing not found');
  });
});
