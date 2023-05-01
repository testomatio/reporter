declare module '@testomatio/reporter';

export interface FileType {
  path: string,
  type: string,
  title?: string,
  testId?: string
} 

export interface TestData {
  title: string;
  suite_title?: string;
  suite_id?: string;
  test_id?: string;
  error?: Error;
  time?: number;
  example?: any;
  files?: string[]|FileType[];
  filesBuffers?: Buffer[];
  steps?: string;
  code?: string;
  message?: string;
}

export interface RunData {
  status: RunStatus;
  create_tests?: boolean;
  tests_count?: number;
  passed_count?: number;
  failed_count?: number;
  skipped_count?: number;
  tests?: TestData[];
}

export enum TestStatus {
  Passed = 'passed',
  Failed = 'failed',
  Skipped = 'skipped'
}

export enum RunStatus {
  Passed = 'passed',
  Failed = 'failed',
  Finished = 'finished'
}

export interface Pipe {

  isEnabled: boolean;           
  store: {},

  createRun(params?: {}): Promise<void>;

  addTest(test: TestData): void;

  /** ends the run */
  finishRun(runParams: RunData): Promise<void>;

  /** name of this pipe */
  toString(): string;
}

