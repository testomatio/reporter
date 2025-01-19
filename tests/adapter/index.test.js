import { assert, expect } from 'chai';
import { exec } from 'child_process';
import ServerMock from 'mock-http-server';
import JestReporter from '../../lib/adapter/jest.js';
import { JasmineReporter } from '../../lib/adapter/jasmine/jasmine.js';
// import { CodeceptReporter } from '../../lib/adapter/codecept.js';
import CucumberReporter from '../../lib/adapter/cucumber/current.js';
import { registerHandlers } from './utils/index.js';
import { config } from './config/index.js';
import { VitestReporter } from '../../lib/adapter/vitest.js';

/* ! note for developers: if you face with error when response from moch server is not received:
probably, the reporter for current adapter is not loaded, run the tests for the specific adapter separately
and check if it works at all; because running tests with this file may hide some logs*/

const { host, port, TESTOMATIO_URL, TESTOMATIO, RUN_ID } = config;

const params = [
  {
    adapterName: JestReporter.name,
    positiveCmd: `TESTOMATIO_URL=${TESTOMATIO_URL} TESTOMATIO=${TESTOMATIO} npm run test:adapter:jest:example`,
    negativeCmd: `TESTOMATIO_URL=${TESTOMATIO_URL} npm run test:adapter:jest:example`,
  },

  {
    adapterName: 'MochaReporter',
    positiveCmd: `TESTOMATIO_URL=${TESTOMATIO_URL} TESTOMATIO=${TESTOMATIO} npm run test:adapter:mocha:example`,
    negativeCmd: `TESTOMATIO_URL=${TESTOMATIO_URL} npm run test:adapter:mocha:example`,
  },
  {
    adapterName: JasmineReporter.name,
    positiveCmd: `TESTOMATIO_URL=${TESTOMATIO_URL} TESTOMATIO=${TESTOMATIO} npm run test:adapter:jasmine:example`,
    negativeCmd: `TESTOMATIO_URL=${TESTOMATIO_URL} npm run test:adapter:jasmine:example`,
  },
  // !TODO: this should be uncommentd when codecept adapter will be rewritten to use ESM
  // {
  //   adapterName: CodeceptReporter.name,
  //   positiveCmd: `TESTOMATIO_URL=${TESTOMATIO_URL} TESTOMATIO=${TESTOMATIO} npm run test:adapter:codecept:example`,
  //   negativeCmd: `TESTOMATIO_URL=${TESTOMATIO_URL} npm run test:adapter:codecept:example`,
  // },
  {
    adapterName: CucumberReporter.name,
    positiveCmd: `TESTOMATIO_URL=${TESTOMATIO_URL} TESTOMATIO=${TESTOMATIO} npm run test:adapter:cucumber:example`,
    negativeCmd: `TESTOMATIO_URL=${TESTOMATIO_URL} npm run test:adapter:cucumber:example`,
  },
  {
    adapterName: VitestReporter.name,
    positiveCmd: `TESTOMATIO_URL=${TESTOMATIO_URL} TESTOMATIO=${TESTOMATIO} npm run test:adapter:vitest:example`,
    negativeCmd: `TESTOMATIO_URL=${TESTOMATIO_URL} npm run test:adapter:vitest:example`,
  },
  {
    adapterName: 'Playwright',
    positiveCmd: `TESTOMATIO_URL=${TESTOMATIO_URL} TESTOMATIO=${TESTOMATIO} npm run test:adapter:playwright:example`,
    negativeCmd: `TESTOMATIO_URL=${TESTOMATIO_URL} npm run test:adapter:playwright:example`,
  },
];

describe('Adapters', () => {
  const server = new ServerMock({ host, port });

  before(done => {
    server.start(() => {
      console.log(`[mock-http-server]: Server started at ${TESTOMATIO_URL}`);

      done();
    });
  });

  after(done => {
    server.stop(() => {
      console.log('[mock-http-server]: Server stopped');

      done();
    });
  });

  for (const { adapterName, positiveCmd, negativeCmd } of params) {
    describe(adapterName, () => {
      describe('positive tests', () => {
        before(function (done) {
          this.timeout(20000);

          registerHandlers(server, RUN_ID);

          exec(positiveCmd, (err, stdout, stderr) => {
            if (err) console.log('Error', err);
            if (process.env.DEBUG) {
              console.log(stdout);
              console.log(stderr);
            }
            done();
          });
        });

        after(() => {
          server.reset();
        });

        it('POST :: /api/reporter :: should create a report if api_key has been provided', () => {
          const [req] = server.requests({ method: 'POST', path: '/api/reporter' });

          const expectedResult = { api_key: TESTOMATIO };

          assert.isObject(req.body);
          expect(req.body).to.include(expectedResult);
        });

        it('PUT :: /api/reporter/:runId :: should update run status', () => {
          const [req] = server.requests({ method: 'PUT', path: `/api/reporter/${RUN_ID}` });

          const expectedResult = { api_key: TESTOMATIO, status_event: 'fail' };

          assert.isObject(req.body);
          expect(req.body).to.include(expectedResult);
        });

        it('POST :: /api/reporter/:runId/testrun :: should add a new test to run instance', () => {
          const reqs = server.requests({ method: 'POST', path: `/api/reporter/${RUN_ID}/testrun` });

          const expectedRequiredBodyKeys = [
            'api_key',
            'files',
            // 'steps',
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
            assert.strictEqual(req.body.api_key, TESTOMATIO);
            if (req.body.tests) {
              // add array of tests
              assert.isArray(req.body.tests);
              for (const test of req.body.tests) {
                assert.includeMembers(Object.keys(test), expectedRequiredBodyKeys);
                assert.isString(test.status);
                assert.isString(test.title);
                assert.isNumber(test.run_time);
              }
            } else {
              // add single test
              assert.includeMembers(Object.keys(req.body), expectedRequiredBodyKeys);
              assert.isString(req.body.status);
              assert.isString(req.body.title);
              assert.isNumber(req.body.run_time);
            }
          }
        });
      });

      describe('negative tests', () => {
        before(function (done) {
          process.env.TESTOMATIO = '';
          this.timeout(20000);

          registerHandlers(server, RUN_ID);

          exec(negativeCmd, () => done());
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
  }
});
