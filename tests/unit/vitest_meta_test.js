import { expect } from 'chai';
import Module from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const mockRunnerPath = path.join(dirname, 'fixtures', 'mock-vitest-runner.cjs');
const originalResolveFilename = Module._resolveFilename;

function mockVitestRunner() {
  Module._resolveFilename = function (request, parent, isMain, options) {
    if (request === '@vitest/runner') return mockRunnerPath;
    return originalResolveFilename.call(this, request, parent, isMain, options);
  };
}

function restoreVitestRunner() {
  Module._resolveFilename = originalResolveFilename;
}

describe('Vitest meta', () => {
  /** @type {typeof import('../../src/reporter-functions.js').default} */
  let reporterFunctions;
  /** @type {ReturnType<typeof import('./fixtures/mock-vitest-runner.cjs').__setCurrentTest>} */
  let setCurrentTest;
  const envBackup = {};

  beforeEach(async () => {
    mockVitestRunner();
    envBackup.VITEST = process.env.VITEST;
    envBackup.VITEST_WORKER_ID = process.env.VITEST_WORKER_ID;
    process.env.VITEST = 'true';
    delete process.env.VITEST_WORKER_ID;

    const moduleUrl = `${pathToImportUrl('../../src/reporter-functions.js')}?t=${Date.now()}`;
    reporterFunctions = (await import(moduleUrl)).default;
    setCurrentTest = require(mockRunnerPath).__setCurrentTest;
    setCurrentTest({ meta: {} });
  });

  afterEach(() => {
    restoreVitestRunner();
    setCurrentTest(null);
    if (envBackup.VITEST === undefined) delete process.env.VITEST;
    else process.env.VITEST = envBackup.VITEST;
    if (envBackup.VITEST_WORKER_ID === undefined) delete process.env.VITEST_WORKER_ID;
    else process.env.VITEST_WORKER_ID = envBackup.VITEST_WORKER_ID;
  });

  it('attaches meta to the current Vitest task', () => {
    const vitestTest = { meta: {} };
    setCurrentTest(vitestTest);

    reporterFunctions.keyValue({ build: '123', env: 'staging' });

    expect(vitestTest.meta).to.deep.equal({ build: '123', env: 'staging' });
  });

  it('merges multiple meta calls on the Vitest task', () => {
    const vitestTest = { meta: {} };
    setCurrentTest(vitestTest);

    reporterFunctions.keyValue({ build: '123' });
    reporterFunctions.keyValue('env', 'staging');

    expect(vitestTest.meta).to.deep.equal({ build: '123', env: 'staging' });
  });

  it('overwrites existing meta keys on the Vitest task', () => {
    const vitestTest = { meta: { build: '123' } };
    setCurrentTest(vitestTest);

    reporterFunctions.keyValue({ build: '456' });

    expect(vitestTest.meta).to.deep.equal({ build: '456' });
  });
});

function pathToImportUrl(relativePath) {
  return new URL(relativePath, import.meta.url).href;
}

function require(modulePath) {
  return Module.createRequire(import.meta.url)(modulePath);
}
