type State = 'pass' | 'fail';

type TestResult = {
  duration: number,
  hooks: {
    beforeEach: State,
    afterEach: State
  },
  repeatCount: number,
  retryCount: number,
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
  result:
  {
    duration: number
    hooks: {
      afterAll: State, beforeAll: State
    },
    startTime: number,
    state: State,
  }
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
  result: TestResult,
  retry: undefined,
  suite: Suite,
  type: 'test',
}
