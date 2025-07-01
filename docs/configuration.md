# Configuration

You can configure Testomat.io reporter with **environment variables**.

Environment variables can be either passed inline, or from `.env` file or from secrets, when running on CI.

> ℹ️ Specifying **any value** for truthy variables activates the setting, e.g. `TESTOMAT_ENABLE_SMTH=true`, `TESTOMAT_ENABLE_SMTH=1`, and even `TESTOMAT_ENABLE_SMTH=false`, `TESTOMAT_ENABLE_SMTH=0` etc do the same - **enable** the setting.

## Variables List

#### `TESTOMATIO`

Alternatively, `TESTOMATIO_TOKEN` or `TESTOMATIO_API_KEY`

Your Project API key for reporting to Testomat.io.

#### `TESTOMATIO_CREATE`

Create test which are not yet exist in a project

```
TESTOMATIO={API_KEY} TESTOMATIO_CREATE=1 <actual run command>
```

#### `TESTOMATIO_WORKDIR`

Specify a custom working directory for relative file paths in test reports. When tests are created with `TESTOMATIO_CREATE=1`, file paths will be relative to this directory instead of the current working directory.

```
TESTOMATIO={API_KEY} TESTOMATIO_CREATE=1 TESTOMATIO_WORKDIR=/path/to/project <actual run command>
```

#### `TESTOMATIO_SUITE`

Place newly created tests into a specific suite. Can be used on XML import or combined with `TESTOMATIO_CREATE=1`. Suite should be specified by its ID:

```
TESTOMATIO={API_KEY} TESTOMATIO_CREATE=1 TESTOMATIO_SUITE=@S1235678 <actual run command>

TESTOMATIO={API_KEY} TESTOMATIO_SUITE=@S1235678 npx @testomatio/reporter xml <xml files>
```

#### `TESTOMATIO_DISABLE_BATCH_UPLOAD`

Disables batch uploading (multiple test results in one request) and uploads each test result one by one.

Example:

```
TESTOMATIO_DISABLE_BATCH_UPLOAD=true <actual run command>
```

#### `TESTOMATIO_ENV`

Specify environments to run the tests.

Example:

```
TESTOMATIO={API_KEY} TESTOMATIO_ENV="Windows, Chrome" <actual run command>
```

#### `TESTOMATIO_EXCLUDE_FILES_FROM_REPORT_GLOB_PATTERN`

Exclude tests from the report using [glob patterns](https://www.npmjs.com/package/glob).

Example:

```
TESTOMATIO_EXCLUDE_FILES_FROM_REPORT_GLOB_PATTERN="**/*.setup.ts" <actual run command>
```

For multiple patterns:

```
TESTOMATIO_EXCLUDE_FILES_FROM_REPORT_GLOB_PATTERN="**/*.setup.ts;tests/*.auth.js" <actual run command>
```

#### `TESTOMATIO_EXCLUDE_SKIPPED`

Exclude skipped tests from the report.

Example:

```
TESTOMATIO_EXCLUDE_SKIPPED=1 <actual run command>
```

#### `TESTOMATIO_NO_TIMESTAMP`

Disable automatic timestamp generation for test results. By default, the reporter automatically adds timestamps to test data. Use this option if you run tests in parallel on different machines where time is not synchronized.

Example:

```
TESTOMATIO_NO_TIMESTAMP=1 <actual run command>
```

#### `TESTOMATIO_INTERCEPT_CONSOLE_LOGS`

Intercept console logs and add them to your report.

Example:

```
TESTOMATIO_INTERCEPT_CONSOLE_LOGS=true <actual run command>
```

#### `TESTOMATIO_MARK_DETACHED`

If some tests from a project were not reported in this run, you can mark them as detached.

**This works only for XML reports**

Example:

```
TESTOMATIO_MARK_DETACHED=true npx @testomatio/reporter xml "tests/**/*.xml"
```

If you pass a tag, only absent tests with this tag will be marked as detached:

```
TESTOMATIO_MARK_DETACHED=@core npx @testomatio/reporter xml "tests/**/*.xml"
```

#### `TESTOMATIO_MAX_REQUEST_FAILURES`

Maximum number of failed requests. If more requests fail, reporting will stop.

Example:

```
TESTOMATIO_MAX_REQUEST_FAILURES=5 <actual run command>
```

#### `TESTOMATIO_REQUEST_TIMEOUT`

Max request timeout in **milli**seconds. Default is 20 sec.

#### `TESTOMATIO_PROCEED`

Do not finalize the run.

Example:

```
TESTOMATIO={API_KEY} TESTOMATIO_PROCEED=1 <actual run command>
```

#### `TESTOMATIO_RUN`

Add a report to the run by ID.

#### `TESTOMATIO_RUNGROUP_TITLE`

Add a report to a RunGroup.

Example:

```
TESTOMATIO={API_KEY} TESTOMATIO_RUNGROUP_TITLE="Build ${BUILD_ID}" <actual run command>
```

Use `/` separator to create a nested rungroup:

```
TESTOMATIO={API_KEY} TESTOMATIO_RUNGROUP_TITLE="Builds/${BUILD_ID}" <actual run command>
```

#### `TESTOMATIO_SHARED_RUN`

Report parallel execution to the same run matching it by title. **If the run was created more than 20 minutes ago, a new run will be created instead.** To change the timeout use `TESTOMATIO_SHARED_RUN_TIMEOUT` variable.

Example:

```
TESTOMATIO={API_KEY} TESTOMATIO_TITLE="report for commit ${GIT_COMMIT}" TESTOMATIO_SHARED_RUN=1 <actual run command>
```

#### `TESTOMATIO_SHARED_RUN_TIMEOUT`

Changes timeout of a shared run. After timeout, shared run won't accept other runs with same name, and new runs will be created instead. Timeout is set in minutes, default is 20 minutes.

Example:

```
TESTOMATIO={API_KEY} TESTOMATIO_TITLE="Today's Build"  TESTOMATIO_SHARED_RUN=1 TESTOMATIO_SHARED_RUN_TIMEOUT=120 <actual run command>
```

In this case all tests will be added to the same run if it was created less than 120 minutes ago.

#### `TESTOMATIO_STACK_FILTER`

Stack trace filter configuration.

#### `TESTOMATIO_STACK_PASSED`

Enable stack traces and logs for passed tests (disabled by default).

Example:

```
TESTOMATIO={API_KEY} TESTOMATIO_STACK_PASSED=1 <actual run command>
```

#### `TESTOMATIO_TITLE`

Set the report title.

Example:

```
TESTOMATIO={API_KEY} TESTOMATIO_TITLE="title for the report" <actual run command>
```

#### `TESTOMATIO_UPDATE_CODE`

Sends the `code` of your tests to Testomat.io on each run. (If not enabled (default) assumes the code is pushed using [check-tests](https://github.com/testomatio/check-tests#cli)).

### Artifacts

Configuration for artifacts storage. Those variables can be obtained from Testomat.io if "Share credentials" in Project Settings > Artifacts is enabled.

- `S3_ACCESS_KEY_ID`: Your S3 access key ID.
- `S3_BUCKET`: Your S3 bucket name.
- `S3_ENDPOINT`: Your S3 endpoint URL.
- `S3_REGION`: Your S3 region.
- `S3_SECRET_ACCESS_KEY`: Your S3 secret access key.
- `TESTOMATIO_PRIVATE_ARTIFACTS`: Store artifacts in a bucket privately.

These variables are used to define how artifacts are uploaded:

- `TESTOMATIO_DISABLE_ARTIFACTS`: disable all artifacts uploading. All artifacts can be uploaded later with `npx @testomatio/reporter upload-artifacts` command.
- `TESTOMATIO_ARTIFACT_MAX_SIZE_MB`: disable uploading artifacts larger than X size in Mb. Other artifacts can be uploaded later with `npx @testomatio/reporter upload-artifacts` command.

### Pipes

Configuration for CI/CD pipelines.

- `GH_PAT`: Your GitHub personal access token (to enable GitHub Pipe)
- `GITLAB_PAT`: Your GitLab personal access token (to enable Gitlab Pipe).

## Loading configuration from `.env` file

You can use `.env` file to store your environment variables. To read environment variables from `.env` file, use [dotenv](https://www.npmjs.com/package/dotenv) package:

```javascript
require('dotenv').config({ path: '.env' }); // or any other path
```

or

```javascript
import dotenv from 'dotenv';
dotenv.config({ path: '.env' }); // or any other path
```

It is recommended to read `.env` file as early as possible in your application, preferably on test runner initialization.
E.g. in CodeceptJS you can do it in `codecept.conf.js` file. In Playwright: `playwright.config.js`. Jest: `jest.config.js`. Cypress: `cypress.config.js`. And so on.

It is recommended to add `.env` file to `.gitignore` to avoid committing sensitive data to the repository.
