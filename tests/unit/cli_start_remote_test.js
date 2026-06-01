import { expect } from 'chai';
import path from 'path';
import { spawn } from 'node:child_process';
import ServerMock from 'mock-http-server';

const host = 'localhost';
const port = 19056;
const TESTOMATIO_URL = `http://${host}:${port}`;
const cliPath = path.resolve(process.cwd(), 'src/bin/cli.js');

function runCli(args, env = {}) {
  return new Promise((resolve, reject) => {
    const childEnv = { ...process.env, TESTOMATIO: 'faketoken', TESTOMATIO_URL };
    for (const key of [
      'TESTOMATIO_RUN',
      'TESTOMATIO_SHARED_RUN',
      'TESTOMATIO_TITLE',
      'TESTOMATIO_CI_PROFILE',
      'TESTOMATIO_CI_PARAMS',
      'TESTOMATIO_LOG_STDERR',
    ]) {
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

function replyRun(uid, status = 200) {
  return {
    method: 'POST',
    path: '/api/reporter',
    reply: {
      status,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(
        status < 400
          ? { uid, url: `${TESTOMATIO_URL}/projects/demo/runs/${uid}`, public_url: `${TESTOMATIO_URL}/p/${uid}` }
          : { message: 'CI launch failed: No settings for github' },
      ),
    },
  };
}

describe('cli start / run --remote', () => {
  const server = new ServerMock({ host, port });

  before(done => server.start(done));
  after(done => server.stop(done));

  describe('start', () => {
    it('with --format prints ONLY the run id on stdout so RUN_ID=$(...) is clean', async () => {
      server.on(replyRun('startrun123'));

      const { code, stdout } = await runCli(['start', '--format', 'id']);

      expect(code).to.equal(0);
      expect(stdout.trim()).to.equal('startrun123');
    });

    it('exits non-zero when the run is not created', async () => {
      server.on(replyRun('ignored', 500));

      const { code, stdout } = await runCli(['start', '--format', 'id']);

      expect(code).to.equal(1);
      expect(stdout.trim()).to.not.equal('ignored');
    });
  });

  describe('run --remote', () => {
    it('reports success and exits 0 when CI launch succeeds', async () => {
      server.on(replyRun('ciRun1'));

      const { code, stdout } = await runCli(['run', '--remote', 'github']);

      expect(code).to.equal(0);
      expect(stdout).to.include('CI build triggered');
    });

    it('exits non-zero and does NOT report success when CI launch fails', async () => {
      server.on(replyRun('ciRun2', 400));

      const { code, stdout, stderr } = await runCli(['run', '--remote', 'github']);

      expect(code).to.equal(1);
      expect(stdout + stderr).to.not.include('CI build triggered');
      expect(stdout + stderr).to.include('CI launch failed');
    });
  });
});
