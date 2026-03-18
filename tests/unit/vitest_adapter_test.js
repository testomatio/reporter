import { expect } from 'chai';
import { VitestReporter } from '../../src/adapter/vitest.js';

function createReporterWithMockedClient() {
  const reporter = new VitestReporter();
  const calls = {
    addTestRun: [],
    updateRunStatus: [],
  };

  reporter.client = {
    createRun: () => {},
    addTestRun: async (status, test) => {
      calls.addTestRun.push({ status, test });
    },
    updateRunStatus: async status => {
      calls.updateRunStatus.push(status);
    },
  };

  return { reporter, calls };
}

function createTest({ name, state, mode = 'run', fileName = 'tests/sample.spec.ts', suiteName = 'suite' }) {
  return {
    type: 'test',
    name,
    mode,
    file: { name: fileName },
    suite: { name: suiteName },
    meta: {},
    result: state ? { state, duration: 5 } : undefined,
  };
}

describe('VitestReporter adapter', () => {
  it('works with onFinished (Vitest <=3)', async () => {
    const { reporter, calls } = createReporterWithMockedClient();

    const file = {
      type: 'suite',
      name: 'root',
      tasks: [
        createTest({ name: 'pass', state: 'pass' }),
        createTest({ name: 'fail', state: 'fail' }),
        createTest({ name: 'skip', mode: 'skip' }),
      ],
    };

    await reporter.onFinished([file], []);

    expect(calls.addTestRun).to.have.length(3);
    expect(calls.addTestRun.map(c => c.status)).to.include.members(['passed', 'failed', 'skipped']);
    expect(calls.updateRunStatus).to.deep.equal(['failed']);
  });

  it('works with onTestRunEnd (Vitest 4)', async () => {
    const { reporter, calls } = createReporterWithMockedClient();

    const testModule = {
      task: {
        type: 'suite',
        name: 'tests/v4.spec.ts',
        tasks: [
          createTest({ name: 'v4 pass', state: 'pass', fileName: 'tests/v4.spec.ts', suiteName: 'v4 suite' }),
          createTest({ name: 'v4 fail', state: 'fail', fileName: 'tests/v4.spec.ts', suiteName: 'v4 suite' }),
          createTest({ name: 'v4 skip', state: 'skip', fileName: 'tests/v4.spec.ts', suiteName: 'v4 suite' }),
        ],
      },
    };

    await reporter.onTestRunEnd([testModule], []);

    expect(calls.addTestRun).to.have.length(3);
    expect(calls.updateRunStatus).to.deep.equal(['failed']);
  });

  it('does not finalize twice in one run', async () => {
    const { reporter, calls } = createReporterWithMockedClient();

    const file = {
      type: 'suite',
      name: 'root',
      tasks: [createTest({ name: 'once', state: 'pass' })],
    };

    await reporter.onFinished([file], []);
    await reporter.onTestRunEnd([{ task: file }], []);

    expect(calls.addTestRun).to.have.length(1);
    expect(calls.updateRunStatus).to.have.length(1);
  });
});
