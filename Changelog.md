# 0.3.15

* Finish Run via API:

```
TESTOMATIO={apiKey} TESTOMATIO_RUN={runId} npx @testomatio/reporter@latest --finish
```

# 0.3.14

* Create an empty Run via API:

```
TESTOMATIO={apiKey} npx @testomatio/reporter@latest --launch
```

# 0.3.13

* Checking for a valid report URL
* Sending unlimited data on test report

# 0.3.12

* Fixed submitting arbitrary data on a test run
* Jest: fixed sending errors with stack traces
* Cypress: fixed sending reports

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
