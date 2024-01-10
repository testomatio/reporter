declare module '@testomatio/reporter';

export interface FileType {
  path: string,
  type: string,
  title?: string,
  testId?: string
}

/**
 * Object representing a unit test result that can be sent to a reporting service.
 */
export interface TestData {
  /** The title of the test case being reported. */
  title: string;

  /** The title of the test suite to which the test case belongs. Required when creating a new test suite inside Testomat.io. */
  suite_title?: string;

  /** file in which test is located */
  file?: string;

  /** The unique identifier from Testomat.io of the test suite to which the test case belongs. */
  suite_id?: string;

  /** The unique identifier from Testomat.io of the test case. If provided, updates the existing test case with the given ID. */
  test_id?: string;

  /** An object representing an error that occurred during the execution of the test case. */
  error?: Error;

  /** The time it took to execute the test case, in milliseconds. */
  time?: number;

  /** Additional data associated with the test case. Used for parametrized tests. */
  example?: any;

  /** An array of file paths or objects representing files associated with the test case. */
  files?: (string | FileType)[];

  /** An array of `Buffer` objects representing files associated with the test case. */
  filesBuffers?: Buffer[];

  /** The steps taken or logs printed during the execution of the test case. */
  steps?: string;

  /** The stack taken or logs printed during the execution of the test case. */
  stack?: string;

  /** The current source code of a test. Used only for JUnit or Newman reports, when we create tests from a run */
  code?: string;

  /** A one-line result message, usually error.message. */
  message?: string;

  /** Logs catched by logger */
  logs?: string;

  /** Manually attached artifacts */
  manuallyAttachedArtifacts?: (string | { path: string, type: string })[];

  /** Meta information (key: value) */
  meta?: { [key: string]: string } | {};
}

/**
 * Object representing a result of a Run.
 */
export interface RunData {
  /** The status of the test run. */
  status: RunStatus;

  /** is this run a part of parallel run */
  parallel: boolean;

  /** A boolean indicating whether new test cases should be created in Testomat.io when submitting the test run. */
  create_tests?: boolean;

  /** The total number of test cases in the test run. Used in JUnit report. */
  tests_count?: number;

  /** The number of test cases that passed in the test run. Used in JUnit report. */
  passed_count?: number;

  /** The number of test cases that failed in the test run. Used in JUnit report. */
  failed_count?: number;

  /** The number of test cases that were skipped in the test run. */
  skipped_count?: number;

  /** 
   * An array of `TestData` objects representing the individual test cases in the test run. 
   * Used for JUNit report when we don't send the tests in realtime but in a batch as a part of final result */
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

  /** starts run  */
  createRun(): Promise<void>;

  /** adds a test to the current run */
  addTest(test: TestData): any;

  /** ends the run */
  finishRun(runParams: RunData): Promise<void>;

  /** name of this pipe */
  toString(): string;
}

export interface PipeResult {
  /** Name of the pipe: Pipe.toString() */
  pipe: string;

  /** the result that pipe returned */
  result?: any;
}

declare global {
  namespace NodeJS {
    interface Global {
      testomatioArtifacts?: any;
      testomatioDataStore?: any;
      TESTOMATIO_LOGGER_CONSOLE_INTERCEPTED?: boolean;
      testomatioTestTitle?: string;
    }
  }
}
