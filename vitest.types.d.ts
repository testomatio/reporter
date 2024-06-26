type State = 'pass' | 'fail';

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
  mode: 'run',
  // for file its filename including relative path
  name: string,
}

export type TestFile = CommonProps & {
  // absolute file path
  filepath: string;
  projectName: string | undefined,
  result: FileResult,
  setupDuration: number
  tasks: Task[], // or (Task | Suite)[]
  type: 'suite',
}

type Suite = CommonProps & {
  each: undefined,
  file: File,
  projectName: string | undefined,
  shuffle: undefined,
  tasks: Task[],
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

type Task = CommonProps & {
  each: undefined,
  fails: undefined,
  file: File,
  logs?: {
    content: string,
    size: number,
    taskId: string,
    time: number,
    type: 'stdout' | 'stderr'
  }[],
  repeats: undefined,
  result: FileResult & {
    errors?: TestError[],
    repeatCount: number,
    retryCount: number,
  },
  retry: undefined,
  suite: Suite,
  type: 'test',
}
