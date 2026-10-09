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
    updateRunStatus: async (status, params = {}) => {
      calls.updateRunStatus.push({ status, ...params });
    },
  };

  return { reporter, calls };
}

function createTest({ name, state, mode = 'run', fileName = 'tests/sample.spec.ts', suiteName = 'suite', startTime }) {
  return {
    type: 'test',
    name,
    mode,
    file: { name: fileName },
    suite: { name: suiteName },
    meta: {},
    result: state ? { state, duration: 5, startTime } : undefined,
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
    expect(calls.updateRunStatus).to.have.length(1);
    expect(calls.updateRunStatus[0]).to.include({ status: 'failed' });
    expect(calls.updateRunStatus[0].duration).to.be.a('number');
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
    expect(calls.updateRunStatus).to.have.length(1);
    expect(calls.updateRunStatus[0]).to.include({ status: 'failed' });
    expect(calls.updateRunStatus[0].duration).to.be.a('number');
  });

  it('sends run duration and test timestamp from start time', async () => {
    const originalDateNow = Date.now;
    let now = 1000000;
    Date.now = () => now;

    try {
      const { reporter, calls } = createReporterWithMockedClient();
      reporter.onInit();

      const file = {
        type: 'suite',
        name: 'root',
        tasks: [createTest({ name: 'pass', state: 'pass', startTime: 1001 })],
      };

      now += 847000;
      await reporter.onTestRunEnd([{ task: file }], []);

      expect(calls.updateRunStatus).to.have.length(1);
      expect(calls.updateRunStatus[0]).to.include({ status: 'passed' });
      expect(calls.updateRunStatus[0].duration).to.equal(847);
      expect(calls.addTestRun).to.have.length(1);
      expect(calls.addTestRun[0].test.timestamp).to.equal(1001000);
    } finally {
      Date.now = originalDateNow;
    }
  });

  it('calculates duration from earliest test result.startTime when run start hook was not called', async () => {
    const originalDateNow = Date.now;
    let now = 2000000;
    Date.now = () => now;

    try {
      const { reporter, calls } = createReporterWithMockedClient();

      const file = {
        type: 'suite',
        name: 'root',
        tasks: [
          createTest({ name: 'a', state: 'pass', startTime: 1000 }),
          createTest({ name: 'b', state: 'pass', startTime: 1100 }),
        ],
      };

      now = 1000 + 130000;
      await reporter.onTestRunEnd([{ task: file }], []);

      expect(calls.updateRunStatus).to.have.length(1);
      expect(calls.updateRunStatus[0]).to.include({ status: 'passed' });
      expect(calls.updateRunStatus[0].duration).to.equal(130);
    } finally {
      Date.now = originalDateNow;
    }
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

  it('does not duplicate tests reported via onTestCaseResult', async () => {
    const { reporter, calls } = createReporterWithMockedClient();
    const test = createTest({ name: 'live', state: 'pass', fileName: 'tests/live.spec.ts', suiteName: 'live suite' });

    await reporter.onTestCaseResult(test);

    const file = {
      type: 'suite',
      name: 'root',
      tasks: [test],
    };
    await reporter.onTestRunEnd([{ task: file }], []);

    expect(calls.addTestRun).to.have.length(1);
    expect(calls.updateRunStatus).to.have.length(1);
    expect(calls.updateRunStatus[0].status).to.equal('passed');
  });

  it('reports live from onTaskUpdate and avoids duplicates on finalize', async () => {
    const { reporter, calls } = createReporterWithMockedClient();
    const test = createTest({ name: 'task update live', state: 'pass' });

    await reporter.onTaskUpdate([[null, null, test]]);

    const file = {
      type: 'suite',
      name: 'root',
      tasks: [test],
    };
    await reporter.onTestRunEnd([{ task: file }], []);

    expect(calls.addTestRun).to.have.length(1);
    expect(calls.updateRunStatus).to.have.length(1);
    expect(calls.updateRunStatus[0].status).to.equal('passed');
  });

  it('ignores non-final onTaskUpdate payloads', async () => {
    const { reporter, calls } = createReporterWithMockedClient();
    const runningUpdate = createTest({ name: 'running', state: undefined, mode: 'run' });

    await reporter.onTaskUpdate([[null, null, runningUpdate]]);
    expect(calls.addTestRun).to.have.length(0);

    const finished = createTest({ name: 'running', state: 'pass', mode: 'run' });
    const file = {
      type: 'suite',
      name: 'root',
      tasks: [finished],
    };

    await reporter.onTestRunEnd([{ task: file }], []);
    expect(calls.addTestRun).to.have.length(1);
    expect(calls.updateRunStatus).to.have.length(1);
    expect(calls.updateRunStatus[0].status).to.equal('passed');
  });

});
