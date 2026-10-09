type RunMode = 'run' | 'skip' | 'only' | 'todo';
type TaskState = RunMode | 'pass' | 'fail';
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

type ErrorWithDiff = {
  cause: string;
  message: string;
  name: string;
  nameStr?: string;
  stack?: string;
  stackStr?: string;
  stacks?: {
    method: string;
    file: string;
    line: number;
    column: number;
  };
  showDiff?: boolean;
  actual?: any;
  expected?: any;
  operator?: string;
  type?: string;
  frame?: string;
  diff?: string;
  codeFrame?: string;
};

interface TaskResult {
  state: TaskState;
  duration?: number;
  startTime?: number;
  heap?: number;
  errors?: ErrorWithDiff[];
  htmlError?: string;
  hooks?: Partial<Record<'beforeAll' | 'afterAll' | 'beforeEach' | 'afterEach', TaskState>>;
  retryCount?: number;
  repeatCount?: number;
}

interface TaskBase {
  id: string;
  name: string;
  mode: RunMode;
  meta: {};
  each?: boolean;
  concurrent?: boolean;
  shuffle?: boolean;
  suite?: Suite;
  file?: File;
  result?: TaskResult;
  retry?: number;
  repeats?: number;
  location?: {
    line: number;
    column: number;
  };
}

export type TestLogs = {
  content: string;
  size: number;
  taskId: string;
  time: number;
  type: 'stdout' | 'stderr';
};

type FileResult = {
  duration: number;
  hooks: {
    beforeEach: TaskState;
    afterEach: TaskState;
  };
  startTime: number;
  state: TaskState;
};

export type Test = TaskBase & {
  logs: TestLogs[];
  type: 'test';
};
