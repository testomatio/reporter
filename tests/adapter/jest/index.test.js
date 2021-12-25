const { exec } = require('child_process');
const { assert } = require('chai');
const ServerMock = require('mock-http-server');
const JestAdapter = require('../../../lib/adapter/jest');

const host = 'localhost';
const port = 9000;
const TESTOMATIO_URL = `http://${host}:${port}`;
const TESTOMATIO = 'e84d71b06590'; // example

const RUN_ID = '0957aa26';

const _exec = (cmd, cb) => {
  exec(cmd, (error, stdout, stderr) => {
    console.log('Running tests', {
      error: Boolean(error), // jest returns exit code 1 if any of the tests fails
      stdoutLength: stdout.length,
      stderrLength: stderr.length,
    });

    cb();
  });
};

const registerHandlers = server => {
  // client.createRun()
  server.on({
    method: 'POST',
    path: '/api/reporter',
    reply: {
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        uid: RUN_ID,
        url: `http://127.0.0.1:3000/projects/test-project/runs/${RUN_ID}/report`,
      }),
    },
  });

  // client.updateRunStatus()
  server.on({
    method: 'PUT',
    path: `/api/reporter/${RUN_ID}`,
    reply: {
      status: 200,
      headers: { 'content-type': 'application/json' },
    },
  });

  // client.addTestRun()
  server.on({
    method: 'POST',
    path: `/api/reporter/${RUN_ID}/testrun`,
    reply: {
      status: 400,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'Test could not be matched' }),
    },
  });
};

describe(JestAdapter.name, () => {
  const server = new ServerMock({ host, port });

  before(done => {
    server.start(() => {
      console.log(`Mock servert started at ${TESTOMATIO_URL}`);

      done();
    });
  });

  after(done => {
    server.stop(done);
  });

  describe('positive tests', () => {
    before(function (done) {
      this.timeout(5000);

      registerHandlers(server);

      _exec(`TESTOMATIO_URL=${TESTOMATIO_URL} TESTOMATIO=${TESTOMATIO} npm run test:adapter:jest:example`, done);
    });

    after(() => {
      server.reset();
    });

    it('POST :: /api/reporter :: should create a report if api_key has been provided', () => {
      const [req] = server.requests({ method: 'POST', path: '/api/reporter' });

      const expectedResult = { api_key: TESTOMATIO };

      assert.isObject(req.body);
      assert.deepEqual(req.body, expectedResult);
    });

    it('PUT :: /api/reporter/:runId :: should update run status', () => {
      const [req] = server.requests({ method: 'PUT', path: `/api/reporter/${RUN_ID}` });

      const expectedResult = { api_key: TESTOMATIO, status_event: 'fail', status: 'failed' };

      assert.isObject(req.body);
      assert.deepEqual(req.body, expectedResult);
    });

    it('POST :: /api/reporter/:runId/testrun :: should add a new test to run instance', () => {
      const reqs = server.requests({ method: 'POST', path: `/api/reporter/${RUN_ID}/testrun` });

      const expectedBodyKeys = [
        'api_key',
        'files',
        'steps',
        'status',
        'stack',
        'example',
        'title',
        'message',
        'run_time',
        'artifacts',
      ];

      for (const req of reqs) {
        assert.isObject(req.body);
        assert.deepEqual(Object.keys(req.body), expectedBodyKeys);

        assert.strictEqual(req.body.api_key, TESTOMATIO);
        assert.isString(req.body.status);
        assert.isString(req.body.title);
        assert.isNumber(req.body.run_time);
      }
    });
  });

  describe('negative tests', () => {
    before(function (done) {
      this.timeout(5000);

      registerHandlers(server);

      _exec(`TESTOMATIO_URL=${TESTOMATIO_URL} npm run test:adapter:jest:example`, done);
    });

    after(() => {
      server.reset();
    });

    it('should ignore reporter if api_key has not been provided', () => {
      const requests = server.requests();

      assert.isArray(requests);
      assert.isEmpty(requests);
    });
  });
});
