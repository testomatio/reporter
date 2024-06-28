import { TaskBase, TaskState } from 'vitest';

type Task = Test | Suite | File;

interface File extends Suite {
  filepath: string;
  collectDuration?: number;
  setupDuration?: number;
}

interface Suite extends TaskBase {
  type: 'suite';
  tasks: Task[];
  filepath?: string;
  projectName: string;
}

export type TestLogs = {
  content: string,
  size: number,
  taskId: string,
  time: number,
  type: 'stdout' | 'stderr'
}

type FileResult = {
  duration: number,
  hooks: {
    beforeEach: TaskState,
    afterEach: TaskState
  },
  startTime: number,
  state: TaskState,
}

type TestError = {
  actual: string, // actual value
  diff: string, // diff between actual and expected values
  expected: string, // expected value
  message: string, // error message
  name: string, // error category name (e.g. AssertionError)
  nameStr: string, // error category name (e.g. AssertionError)
  operator: string, // e.g. strictEqual
  showDiff: boolean,
  stack: string,
  stackStr: string,
}

export type Test = TaskBase & {
  logs: TestLogs[],
  type: 'test',
}
