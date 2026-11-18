import { expect } from 'chai';
import path from 'path';
import { spawn } from 'node:child_process';
import ServerMock from 'mock-http-server';

const host = 'localhost';
const port = 19057;
const TESTOMATIO_URL = `http://${host}:${port}`;
const RUN_ID = 'testrunid1';
const cliPath = path.resolve(process.cwd(), 'src/bin/cli.js');

function runCli(args, env = {}) {
  return new Promise((resolve, reject) => {
    const childEnv = {
      ...process.env,
      TESTOMATIO: 'faketoken',
      TESTOMATIO_URL,
      TESTOMATIO_RUN: RUN_ID,
    };
    for (const key of ['TESTOMATIO_FINISH_SHARED_RUN', 'TESTOMATIO_PROCEED']) {
      delete childEnv[key];
    }
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

function replyFinish() {
  return {
    method: 'PUT',
    path: `/api/reporter/${RUN_ID}`,
    reply: {
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ uid: RUN_ID }),
    },
  };
}

describe('cli finish', () => {
  const server = new ServerMock({ host, port });

  before(done => server.start(done));
  after(done => server.stop(done));
  afterEach(() => server.reset());

  it('sends finish request without force_finish_shared_run by default', async () => {
    server.on(replyFinish());

    const { code } = await runCli(['finish']);

    expect(code).to.equal(0);
    const [req] = server.requests({ method: 'PUT', path: `/api/reporter/${RUN_ID}` });
    expect(req).to.exist;
    expect(req.body).to.not.have.property('force_finish_shared_run');
  });

  it('does not send force_finish_shared_run when TESTOMATIO_FINISH_SHARED_RUN=0', async () => {
    server.on(replyFinish());

    const { code } = await runCli(['finish'], { TESTOMATIO_FINISH_SHARED_RUN: '0' });

    expect(code).to.equal(0);
    const [req] = server.requests({ method: 'PUT', path: `/api/reporter/${RUN_ID}` });
    expect(req).to.exist;
    expect(req.body).to.not.have.property('force_finish_shared_run');
  });

  it('sends force_finish_shared_run=true when TESTOMATIO_FINISH_SHARED_RUN is set', async () => {
    server.on(replyFinish());

    const { code } = await runCli(['finish'], { TESTOMATIO_FINISH_SHARED_RUN: '1' });

    expect(code).to.equal(0);
    const [req] = server.requests({ method: 'PUT', path: `/api/reporter/${RUN_ID}` });
    expect(req).to.exist;
    expect(req.body).to.have.property('force_finish_shared_run', true);
  });
});
