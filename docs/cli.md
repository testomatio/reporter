# CLI

The Testomat.io Reporter CLI is a powerful tool for managing test runs, parsing XML reports, and uploading artifacts. CLI can be used to start and finish test runs, run tests, parse XML reports, and upload artifacts. It can be used in CI/CD pipelines or locally.

Reporter is designed to work with [Testomat.io](https://testomat.io) service but not exclusively

## Installation

```bash
npm install -g @testomatio/reporter
```

## General Usage

```bash
npx @testomatio/reporter <command> [options]
```

## Available Commands

### 1. start

Starts a new test run and returns its ID. This requires an API key to be set in the `TESTOMATIO` environment variable.

**Usage:**

```bash
npx @testomatio/reporter start [options]
```

**Environment Variables:**

- `TESTOMATIO`: Your Testomat.io API project key in format: `tstmt_*` (required).

**Options:**

- `--env-file <envfile>`: Load environment variables from a specific env file. If none specified, it will look for `.env` file.

> Previously known as: `npx start-test-run --launch` _(before 1.6.0)_

### 2. finish

Finishes a run by its ID.

**Usage:**

```bash
npx @testomatio/reporter finish [options]
```

**Environment Variables:**

- `TESTOMATIO`: Your Testomat.io API key in format: `tstmt_*` (required).

**Options:**

- `--env-file <envfile>`: Load environment variables from a specific env file. If none specified, it will look for `.env` file.

> Previously known as: `npx start-test-run --finish` _(before 1.6.0)_

### 3. run

Creates a run, and runs tests with the specified command, then finishes the run. This command ensures that if test runner spawns parallel workers or processes and reports it will report to the same run.

> Use `npx @testomatio/reporter run` if multiple run reports are created on the same launch

**Usage:**

```bash
npx @testomatio/reporter run [options]
```

**Environment Variables:**

- `TESTOMATIO`: Your Testomat.io API key in format: `tstmt_*` (required).

**Options:**

- `-c, --command <cmd>`: Test runner command (required).
- `--filter <filter>`: [Filter executed tests](./pipes/testomatio.md#filter-tests) by tag, label, jira, plan.
- `--env-file <envfile>`: Load environment variables from a specific env file.

**Examples:**

```bash
npx @testomatio/reporter run "npm test"
npx @testomatio/reporter run "npx jest" --filter "testomatio:tag=frontend"
npx @testomatio/reporter run "npx jest" --filter "testomatio:label=Smoke"
npx @testomatio/reporter run "npx jest" --filter "testomatio:jira=TC-123"
npx @testomatio/reporter run "npx jest" --filter "testomatio:plan=a123fb12"
npx @testomatio/reporter run "mocha tests/" --env-file .env.test
```

> Previously known as: `npx start-test-run -c "command"` _(before 1.6.0)_

### 4. xml

Parses XML reports in JUnit (NUnit, xUnit, TRX) XML format and uploads them to Testomat.io or uses GitHub / GitLab / ButBucket pipe to create a mini-report

**Usage:**

```bash
npx @testomatio/reporter xml <pattern> [options]
```

**Environment Variables:**

- `TESTOMATIO`: Your Testomat.io API key in format: `tstmt_*` if you want to upload reports to Testomat.io (optional).

**Arguments:**

- `<pattern>`: XML file pattern (required).

**Options:**

- `-d, --dir <dir>`: Project directory.
- `--java-tests [java-path]`: Load Java tests from path (default: src/test/java).
- `--lang <lang>`: Language used (python, ruby, java).
- `--timelimit <time>`: Default time limit in seconds to kill a stuck process.
- `--env-file <envfile>`: Load environment variables from a specific env file.

**Examples:**

```bash
npx @testomatio/reporter xml "test-results/**.xml" --lang python
npx @testomatio/reporter xml "junit-reports/**.xml" -d ./project --lang java
npx @testomatio/reporter xml "pytest-results.xml" --timelimit 300 --env-file .env.test
```

> Previously known as: `npx report-xml` _(before 1.6.0)_

### 5. upload-artifacts

Testomat.io reporter automatically uploads artifacts during run. However, either some artifacts failed to upload or you intentioanlly disabled file upload during tests to speed up reporting. In this case you can use this command to upload artifacts after the run.

It is important to have the `TESTOMATIO_RUN` environment variable set to the run ID.

**Usage:**

```bash
npx @testomatio/reporter upload-artifacts [options]
```

**Environment Variables:**

- `TESTOMATIO`: Your Testomat.io API key (required).
- `TESTOMATIO_RUN`: The previous run ID you want to upload artifacts (optional). If none set, latest run will be used.

**Options:**

- `--force`: Re-upload artifacts even if they were uploaded before.
- `--env-file <envfile>`: Load environment variables from a specific env file.

You still need [S3 artifacts configuration](./artifacts.md) to be set to upload artifacts to storage. In order to disable artifacts upload during tests you can use `TESTOMATIO_DISABLE_ARTIFACTS=1` while running tests.

**Examples:**

```bash
npx @testomatio/reporter upload-artifacts
npx @testomatio/reporter upload-artifacts --force
npx @testomatio/reporter upload-artifacts --env-file .env.prod
```

With Playwright:

```bash
TESTOMATIO=tstmt_* TESTOMATIO_DISABLE_ARTIFACTS=1 npx playwright test
TESTOMATIO=tstmt_* npx @testomatio/reporter upload-artifacts
```

With webdriverio:

```bash
TESTOMATIO=tstmt_* TESTOMATIO_DISABLE_ARTIFACTS=1 npx @testomatio/reporter run "npx wdio"
TESTOMATIO=tstmt_* npx @testomatio/reporter upload-artifacts
```

You can also upload small artifacts during the run, while large files can be uploaded after. For instance, all files uploading larger than 10MB will be skipped during the run.

```bash
TESTOMATIO=tstmt_* TESTOMATIO_ARTIFACT_MAX_SIZE_MB=10 npx playwright test
TESTOMATIO=tstmt_* npx @testomatio/reporter upload-artifacts
```

However, `upload-artifacts` command will upload all files after the run, without blocking the final result.

### 6. replay

The `replay` command allows you to re-send test data from debug files to Testomat.io. This is useful when your original test run failed to upload results properly.

**Usage:**
```bash
npx @testomatio/reporter replay [debug-file] [options]
```

**Arguments:**
- `debug-file` (optional) - Path to debug file. Defaults to `/tmp/testomatio.debug.latest.json`

**Options:**
- `--dry-run` - Preview the data without sending to Testomat.io
- `--env-file <envfile>` - Load environment variables from env file

**Examples:**

```bash
# Replay the latest debug data
TESTOMATIO=<your-api-key> npx @testomatio/reporter replay

# Replay from a specific debug file
TESTOMATIO=<your-api-key> npx @testomatio/reporter replay /path/to/debug.json

# Preview what would be sent without actually sending
TESTOMATIO=<your-api-key> npx @testomatio/reporter replay --dry-run

# Use environment file
npx @testomatio/reporter replay --env-file .env.staging
```

**How it works:**

The replay command uses the `ReplayService` class (located in `src/replay.js`) to:

1. Parse the debug file line by line
2. Extract environment variables, run parameters, test data, and finish parameters
3. Restore environment variables (without overriding existing ones)
4. Create a new test run using the TestomatClient
5. Send each test result individually
6. Update the run status when complete

**Debug File Format:**

Debug files contain JSON lines with timing information and test data:
- Environment variables: Testomatio-related environment variables
- Run parameters: Parameters used to create the test run  
- Test batches: All test results with full details including steps, errors, and metadata
- Finish parameters: Final run status and configuration

For more details about debug files, see the [Debug Pipe documentation](pipes/debug.md).

## Environment Variables

Many commands rely on environment variables. You can set these in a command line, in a `.env` file, or use the `--env-file` option to specify a custom env file. Important variables include:

- `TESTOMATIO`: Your Testomat.io API key.
- `TESTOMATIO_RUN`: The current run ID (usually set automatically by the `start` command).
- `TESTOMATIO_TITLE`: Title for the test run (optional).
- [more..](./configuration.md)

## Tips

1. Always ensure your Testomat.io API key is properly set before running commands.
2. Use the `--env-file` option when you have different configurations for various environments.
3. The `run` command is versatile and can be used with various test runners like Jest, Mocha, or custom scripts.
4. When using the `xml` command, ensure your XML reports are in a supported format.
5. The `upload-artifacts` command is useful for adding additional files or logs to your test runs.

For more detailed information or troubleshooting, please refer to the Testomat.io documentation or contact support.
