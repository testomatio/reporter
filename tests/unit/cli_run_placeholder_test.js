import { expect } from 'chai';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'node:child_process';
import ServerMock from 'mock-http-server';

const host = 'localhost';
const port = 19061;
const TESTOMATIO_URL = `http://${host}:${port}`;
const cliPath = path.resolve(process.cwd(), 'src/bin/cli.js');
const failingScript = path.join(os.tmpdir(), `testomatio-cli-fail-${process.pid}.js`);
fs.writeFileSync(failingScript, 'process.exit(1);');

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
          : { message: 'not created' },
      ),
    },
  };
}

function replyTestGrep(tests = ['Tabc123']) {
  return {
    method: 'GET',
    path: '/api/test_grep',
    reply: {
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tests }),
    },
  };
}

function replyFinishRun(uid, received) {
  const handler = () => ({
    method: 'PUT',
    path: `/api/reporter/${uid}`,
    reply: {
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: req => {
        received.push(req.body);
        return JSON.stringify({});
      },
    },
  });
  return handler;
}

describe('cli run: placeholder & failed-command UX', () => {
  const server = new ServerMock({ host, port });

  before(function (done) {
    this.timeout(10000);
    server.start(done);
  });
  after(function (done) {
    this.timeout(10000);
    fs.rmSync(failingScript, { force: true });
    server.stop(done);
  });

  it('rejects a "<run tests>" placeholder with a friendly error instead of an ENOENT crash', async () => {
    const { code, stdout, stderr } = await runCli(['run', '<run tests>']);

    expect(code).to.equal(1);
    expect(stdout + stderr).to.include('placeholder');
    expect(stdout + stderr).to.include('test runner command');
    expect(stdout + stderr).to.not.include('ENOENT');
    expect(stdout + stderr).to.not.include('throw er;');
  });

  it('rejects a placeholder even when --filter resolved tests for it', async () => {
    server.on(replyTestGrep());

    const { code, stdout, stderr } = await runCli(['run', '<run tests>', '--filter', 'testomatio:plan=xyz']);

    expect(code).to.equal(1);
    expect(stdout + stderr).to.include('placeholder');
    expect(stdout + stderr).to.not.include('ENOENT');
  });

  it('reports a clean error for a command that does not exist and marks the run failed', async () => {
    const finishRequests = [];
    server.on(replyRun('enorun1'));
    server.on(replyFinishRun('enorun1', finishRequests)());

    const { code, stdout, stderr } = await runCli(['run', 'this-command-does-not-exist-xyz']);

    expect(code).to.equal(1);
    expect(stdout + stderr).to.include('Command not found');
    expect(stdout + stderr).to.include('this-command-does-not-exist-xyz');
    expect(stdout + stderr).to.not.include('throw er;');
    expect(finishRequests.length).to.be.at.least(1);
    expect(JSON.stringify(finishRequests)).to.include('fail');
  });

  it('explains the applied filter when the runner exits with a non-zero code', async () => {
    const finishRequests = [];
    server.on(replyTestGrep());
    server.on(replyRun('filterrun1'));
    server.on(replyFinishRun('filterrun1', finishRequests)());

    const { code, stdout, stderr } = await runCli([
      'run',
      `node ${failingScript}`,
      '--filter',
      'testomatio:plan=xyz',
    ]);

    expect(code).to.equal(1);
    expect(stdout + stderr).to.include('--grep');
    expect(stdout + stderr).to.include('filter was applied');
    expect(stdout + stderr).to.include('@T');
  });
});
