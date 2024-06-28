type State = 'pass' | 'fail';

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
    beforeEach: State,
    afterEach: State
  },
  startTime: number,
  state: State,
}

type CommonProps = {
  id: string,
  meta: { [key: string]: any },
  mode: 'run' | 'skip',
  // for file its filename including relative path
  name: string,
}

export type TestFile = CommonProps & {
  filepath: string; // absolute file path
  projectName: string | undefined,
  result: FileResult,
  setupDuration: number
  tasks: (Task | Suite)[]
  type: 'suite',
}

export type Suite = CommonProps & {
  each: undefined,
  file: TestFile,
  projectName: string | undefined,
  result: FileResult,
  shuffle: undefined,
  tasks: (Suite | Task)[],
  type: 'suite',
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

export type Task = CommonProps & {
  each: undefined,
  fails: undefined,
  file: TestFile,
  logs?: TestLogs[],
  repeats: undefined,
  result?: FileResult & {
    errors?: TestError[],
    repeatCount: number,
    retryCount: number,
  },
  retry: undefined,
  suite: Suite,
  type: 'test',
}
