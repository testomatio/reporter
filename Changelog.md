<!-- pending release updates -->
# 1.0.17

Renamed `TESTOMATIO_STACK_FILTER` to `TESTOMATIO_STACK_IGNORE`

# 1.0.16

* Addded [stack trace configuration](./docs/stacktrace.md) and documentation:

```
TESTOMATIO_STACK_IGNORE="tests/support/**.js" <actual-run-command>
```
* Jest: fixed reporting tests without a suite title

# 1.0.15

* Attach Run to Jira Issue via `TESTOMATIO_JIRA_ID` env variable:

```
TESTOMATIO_JIRA_ID=TST-12 <actual run command>
```

* Mocha - removed requirement of TESTOMATIO API Key

# 1.0.14

* Execute tests by tag names. Use this filter to select tests associated with specific tags.
  
  ```bash
  TESTOMATIO={API_KEY} npx start-test-run -c 'actual run command' --filter 'testomatio:tag-name=smoke'
  ```

  * more instruction you can find in docs/pipes/testomatio.md

# 1.0.13

* JUnit improvements
  * Match test from source code by adding Test ID as a comment:

  ```java
  // @T8acca9eb
  ```
  * Match test from output by adding Test ID as output:

  ```java
  System.out.println("tid://@T8acca9eb");
  ```
  * Support for suite before and after output
  * Improved support for artifacts

# 1.0.12

& Logger refactoring by @olexandr13 in #208
* fix undefined logs by @olexandr13 in #210

# 1.0.11

* fix steps duplication for codecept report by @olexandr13 in #209

# 1.0.10

* Added `TESTOMATIO_PUBLISH=1` variable to automatically publish run report

# 1.0.9

* Support XUnit format
* Improved support for parametrized Java tests

# 1.0.8 

* Fixed `Can't read push of undefined` when logging steps

# 1.0.6

* Testomat.io. Auto-detect current build url and report it to Testomat.io. Manually url can be set with `BUILD_URL` variable:

```
BUILD_URL=https://.... TESTOMATIO=apiKey <actual test command>
```

# 1.0.5 

* Fix "create tests" params processing for testomatio pipe

# 1.0.4

* Fixed parallel run

# 1.0.3

* Fixed reporting parallel runs

# 1.0.0


* Added [`TESTOMATIO_SHARED_RUN` option](https://github.com/testomatio/reporter/blob/master/docs/pipes.md#reporting-parallel-execution-to-to-same-run) to use a shared run for parallel executions
* Reworked [documentation](https://github.com/testomatio/reporter/tree/master#readme).
* Added an option to obtain [S3 configuration](https://github.com/testomatio/reporter/blob/master/docs/artifacts.md#configuration) from Testomat.io
* Introduced [pipes](https://github.com/testomatio/reporter/blob/master/docs/pipes.md):
  * GitHub
  * GitLab
  * CSV Pipe


# 0.7.6

* Updated to use AWS S3 3.0 SDK for uploading

# 0.7.5

* Fixed reporting skipped tests in mocha

# 0.7.4

* Fixed parsing source code in JUnit files

# 0.7.3

* CodeceptJS: Upload all traces and videos from artifacts
* Fixed reporting skipped test in XML
* added `--timelimit` option to `report-xml` command line

# 0.7.2

* Fixed uploading non-existing file

# 0.7.1

* Support for NUnit XML v3 format

# 0.7.0

* Support for `@cucumber/cucumber` (>= 7.0) added
* Initial support for C# and NUnit  

# 0.6.10

* Fixed uploading multilpe artifacts in Playwright

# 0.6.9

* Fixed pending tests reports for Cypress

# 0.6.8
# 0.6.7

* Pytest: fixed creating suites from reports

# 0.6.6

* JUnit reporter: prefer suite title over testcase classname in a report

# 0.6.5

* Fixed test statuses for runs in JUnit reporter

# 0.6.4

* Added `TESTOMATIO_PROCEED=1` param to not close current run
* Fixed priority of commands from `npx @testomatio/reporter`

# 0.6.3

* Fixed `npx start-test-run` to launch commands

# 0.6.2

* Added `--env-file` option to load env variables from env file

# 0.6.1

* Fixed creating RunGroup with JUnit reporter

# 0.6.0

* JUnit reporter support

# 0.5.10

* Fixed reporting Scenario Outline in Cypress-Cucumber
* Fixed error reports for Cypress when running in Chrome

# 0.5.9

* Added environment on Cypress report

# 0.5.8

* Fixed Cypress.io reporting

# 0.5.7

* Fixed webdriverio artifacts

# 0.5.6

* Unmark failed CodeceptJS tests as skipped

# 0.5.5

* Fixed `BeforeSuite` failures in CodeceptJS

# 0.5.4

Added `TESTOMATIO_CREATE=1` option to create unmatched tests on report

```
TESTOMATIO_CREATE=1 TESTOMATIO=apiKey npx codeceptjs run
```

# 0.5.3

* Fixed parsing suites

# 0.5.2

* Fixed multiple upload of artifacts in Cypress.io

# 0.5.1

* Fixed Cypress.io to report tests inside nested suites

# 0.5.0

* Added Cypress.io plugin
* Added artifacts upload to webdriverio

# 0.4.6

- Fixed CodeceptJS reporter to report tests failed in hooks

# 0.4.5

- Fixed "Total XX artifacts publicly uploaded to S3 bucket" when no S3 bucket is configured
- Improved S3 connection error messages

# 0.4.4

- Fixed returning 0 exit code when a process fails when running tests in parallel via `start-test-run`. Previously was using the last exit code returned by a process. Currently prefers the highest exit code that was returned by a process.

# 0.4.3

- Added `TESTOMATIO_DISABLE_ARTIFACTS` env variable to disable publishing artifacts.

# 0.4.2

- print version of reporter
- print number of uploaded artifacts
- print access mode for uploaded artifacts

# 0.4.1

Added `global.testomatioArtifacts = []` array which can be used to add arbitrary artifacts to a report.

```js
// inside a running test:
global.testomatioArtifacts.push('file/to/upload.png');
```

# 0.4.0

- Playwright: Introduced playwright/test support with screenshots and video artifacts

> Known issues: reporting using projects configured in Playwright does not work yet

- CodeceptJS: added video uploads

# 0.3.16

- CodeceptJS: fixed reporting tests with empty steps (on retry)

# 0.3.15

- Finish Run via API:

```
TESTOMATIO={apiKey} TESTOMATIO_RUN={runId} npx @testomatio/reporter@latest --finish
```

# 0.3.14

- Create an empty Run via API:

```
TESTOMATIO={apiKey} npx @testomatio/reporter@latest --launch
```

# 0.3.13

- Checking for a valid report URL
- Sending unlimited data on test report

# 0.3.12

- Fixed submitting arbitrary data on a test run
- Jest: fixed sending errors with stack traces
- Cypress: fixed sending reports

# 0.3.11

- Fixed circular JSON reference when submitting data to Testomatio

# 0.3.10

- Minor fixes

# 0.3.9

- Making all reporters to run without API key

# 0.3.8

- Fixed `npx start-test-run` to work with empty API keys

# 0.3.7

- Fixed release

# 0.3.6

- Update title and rungroup on start for scheduled runs.

# 0.3.5

- Added `TESTOMATIO_RUN` environment variable to pass id of a specific run to report

# 0.3.4

- Minor fixes

# 0.3.3

- [CodeceptJS] Fixed stack trace reporting
- [CodeceptJS] Fixed displaying of nested steps
- [CodeceptJS][mocha] Added assertion diff to report

# 0.3.2

- Fixed error message for S3 uploading

# 0.3.1

- [CodeceptJS] Better formatter for nested structures and BDD tests

# 0.3.0

- Added `TESTOMATIO_TITLE` env variable to set a name for Run
- Added `TESTOMATIO_RUNGROUP_TITLE` env variable to attach Run to RunGroup
- Added `TESTOMATIO_ENV` env variable to attach additional env values to report
- [CodeceptJS] **CodeceptJS v3 support**
- [CodeceptJS] Dropped support for CodeceptJS 2
- [CodeceptJS] Added support for before hooks
- [CodeceptJS] Log of steps
- [CodeceptJS] Upload screenshots of failed tests to S3
- [CodeceptJS] Updated to use with parallel execution
