import { expect } from 'chai';
import path from 'path';
import { spawn } from 'node:child_process';
import ServerMock from 'mock-http-server';

const host = 'localhost';
const port = 19059;
const TESTOMATIO_URL = `http://${host}:${port}`;
const PROJECT = 'demo';
const cliPath = path.resolve(process.cwd(), 'src/bin/cli.js');

function runCli(args, env = {}) {
  return new Promise((resolve, reject) => {
    const childEnv = { ...process.env, TESTOMATIO: 'faketoken', TESTOMATIO_URL };
    delete childEnv.TESTOMATIO_PROJECT;
    Object.assign(childEnv, env);

    const child = spawn(process.execPath, [cliPath, ...args], {
      env: childEnv,
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
