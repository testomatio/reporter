# CLI

The Testomat.io Reporter CLI is a powerful tool for managing test runs, parsing XML reports, and uploading artifacts. CLI can be used to start and finish test runs, run tests, parse XML reports, and upload artifacts. It can be used in CI/CD pipelines or locally.

Reporter is designed to work with [Testomat.io](https://testomat.io) service but not exclusively

## Installation

```bash
npm install -g @testomatio/reporter
```

For Yarn 4 (Berry), install and run CLI wrapper:

```bash
yarn add -D testomatio-reporter-cli
npx testomatio-reporter <command> [options]
```

## General Usage

```bash
npx @testomatio/reporter <command> [options]
```

## Available Commands

### 1. start

Starts a new test run and returns its ID. This requires an API key to be set in the `TESTOMATIO` environment variable.

With `--format id` (or any `--format`), `start` prints **only the run id to `stdout`** (the banner and progress logs go to `stderr`), so it is safe to capture: `RUN_ID=$(npx @testomatio/reporter start --format id)`. It exits non-zero if the run could not be created.

**Usage:**

```bash
npx @testomatio/reporter start [options]
```

**Examples:**

```bash
npx @testomatio/reporter start
npx @testomatio/reporter start --kind manual
npx @testomatio/reporter start --kind mixed
npx @testomatio/reporter start --filter "testomatio:tag-name=smoke"
```

**Environment Variables:**

- `TESTOMATIO`: Your Testomat.io API project key in format: `tstmt_*` (required).

**Options:**

- `--env-file <envfile>`: Load environment variables from a specific env file. If none specified, it will look for `.env` file.
- `--kind <type>`: Specify run type: `automated`, `manual`, or `mixed`. Determines how the test run is categorized in Testomat.io.
- `--filter <filter>`: Scope the prepared run to the tests matching the filter (same syntax as [`run --filter`](#31-filter-pipes)). The run is created with that test list but **not** executed — useful to prepare a run and launch it later on CI (see [Prepare a run, then launch it on CI](#34-prepare-a-run-then-launch-it-on-ci)).
- `--format <format>`: Print **only the run id** to `stdout` (banner and logs go to `stderr`) so it can be captured: `RUN_ID=$(npx @testomatio/reporter start --format id)`.

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

Alias for this command – `test`, e.g. `npx @testomatio/reporter test [options]`

**Environment Variables:**

- `TESTOMATIO`: Your Testomat.io API key in format: `tstmt_*` (required).

**Options:**

- `-c, --command <cmd>`: Test runner command (required).
- `--filter <filter>`: [Filter executed tests](./pipes/testomatio.md#filter-tests) by tag, label, jira, plan.
- `--filter-list <filter>`: Print the list of tests matching the filter without running them. Useful for inspecting which tests would run, or for piping IDs into another command. See [Coverage Pipe](./pipes/coverage.md#machine-readable-output-with---format) for examples.
- `--format <format>`: Machine-readable output format for `--filter-list`. Supported values: `grep`, `json`, `newline`, `ids`. When set, the CLI banner is suppressed and informational logs go to `stderr` so `stdout` stays clean for piping.
- `--env-file <envfile>`: Load environment variables from a specific env file.
- `--kind <type>`: Specify run type: `automated`, `manual`, or `mixed`. Determines how the test run is categorized in Testomat.io.
- `--remote <profile>`: Trigger the run on a CI profile configured on the Testomat.io project (e.g. `github`, `gitlab`, `jenkins`) instead of executing tests locally. The CLI creates the run on Testomat.io, asks the backend to dispatch the named CI workflow, and exits. Equivalent to setting [`TESTOMATIO_CI_PROFILE`](./configuration.md#testomatio_ci_profile).
- `--remote-param <kv>`: `key=value` pair forwarded to the CI profile config (e.g. `branch=develop`). Repeat the option to pass multiple params. Equivalent to setting [`TESTOMATIO_CI_PARAMS`](./configuration.md#testomatio_ci_params).

**Examples:**

```bash
npx @testomatio/reporter run "npm test"
npx @testomatio/reporter run "npx jest" --filter-list "testomatio:tag-name=frontend"
npx @testomatio/reporter run "npx jest" --filter "testomatio:tag-name=frontend"
npx @testomatio/reporter run "npx jest" --filter "testomatio:label=Smoke"
npx @testomatio/reporter run "npx jest" --filter "testomatio:jira=TC-123"
npx @testomatio/reporter run "npx jest" --filter "testomatio:plan=a123fb12"
npx @testomatio/reporter run "npx jest" --filter-list "coverage:file=coverage.yml,diff=user-branch"
npx @testomatio/reporter run --filter-list "coverage:file=coverage.yml" --format grep
npx @testomatio/reporter run "npx jest" --filter "coverage:file=coverage.yml,diff=user-branch"
npx @testomatio/reporter run "npx jest" --filter "coverage:file=coverage/coverage.yml"
npx @testomatio/reporter run "mocha tests/" --env-file .env.test
npx @testomatio/reporter run "npm test" --kind manual
npx @testomatio/reporter run "npx jest" --kind mixed
```

#### 3.1 Filter pipes

> `--filter` and `--filter-list` only work with the `testomatio:` and `coverage:` pipes (e.g. `testomatio:tag-name=smoke`, `coverage:file=coverage.yml`). Any other prefix is rejected.

#### 3.2 Machine-readable output with `--format`

With `--filter-list`, `--format` controls how the matched test IDs are printed to `stdout` (`ids` by default; also `grep`, `json`, `newline`). The banner is suppressed and logs go to `stderr`, so the output is safe to pipe or capture. Full reference, formats, and exit codes: [The `--format` flag](#the---format-flag).

**Example: pipe matched tests straight into a runner's grep flag**

```bash
GREP=$(npx @testomatio/reporter run --filter-list "coverage:file=coverage.yml" --format grep)
npx playwright test --grep "$GREP"
```

**Example: capture IDs as JSON for further processing**

```bash
npx @testomatio/reporter run --filter-list "coverage:file=coverage.yml" --format json > affected-tests.json
```

#### 3.3 Trigger a remote CI run with `--remote`

`--remote <profile>` skips local execution and asks Testomat.io to dispatch a CI workflow defined under a project's CI profile (see [Testomat.io Pipe → Trigger a Remote CI Run](./pipes/testomatio.md#trigger-a-remote-ci-run)). The CLI creates the run, attaches the named profile + any filter-resolved grep, and exits — your CI is responsible for running the tests and reporting results back into the same run.

Works with every `--filter` form (`coverage:...`, `testomatio:tag-name=...`, `:plan=...`, `:label=...`, `:jira-ticket=...`): the resolved test ids are joined with `|` and forwarded as the CI grep pattern. Without `--filter` the CI workflow runs whatever it normally would.

**Basic usage:**

```bash
npx @testomatio/reporter run --remote github
npx @testomatio/reporter run --remote github --filter "coverage:file=coverage.manual.yml,diff=master"
npx @testomatio/reporter run --remote gitlab --filter "testomatio:tag-name=smoke"
npx @testomatio/reporter run --remote jenkins --remote-param branch=develop --remote-param REGION=eu
```

**Behaviour & guards**

- Requires a Testomat.io API key (`TESTOMATIO`); the CLI exits `1` otherwise.
- Cannot be combined with `--filter-list` — the CLI exits `1` with a clear error. Use one or the other.
- Any positional command is ignored with a warning, so existing scripts can toggle `--remote` on without further edits.
- If `--filter` resolves to zero tests the run is not created — same `No tests found.` early-return as the regular flow.
- The CI profile must exist on the project (configured in Testomat.io under **Settings → CI**). Resolution errors are surfaced as `CI launch failed: <message>` and exit `1`.

The same configuration can be set via env vars (e.g. for users who don't pass through the CLI): [`TESTOMATIO_CI_PROFILE`](./configuration.md#testomatio_ci_profile) and [`TESTOMATIO_CI_PARAMS`](./configuration.md#testomatio_ci_params).

#### 3.4 Prepare a run, then launch it on CI

`--remote` can also launch a run that was prepared earlier, splitting "create the run" and "trigger CI" into two separate steps. This is useful when one job (or person) decides _what_ to run and a later step (a gate, a button, another pipeline) decides _when_ to launch it.

**Step 1 — prepare a scheduled run (no CI), capturing its scope:**

```bash
RUN_ID=$(npx @testomatio/reporter start --filter "testomatio:tag-name=smoke" --format id)
```

The run is created with the matched tests and stays scheduled — nothing is executed and no CI is triggered yet. `--format id` keeps `stdout` to just the run id so `RUN_ID` captures it cleanly.

**Step 2 — launch that run on CI:**

```bash
TESTOMATIO_RUN=$RUN_ID npx @testomatio/reporter run --remote github
```

Because `TESTOMATIO_RUN` points at the prepared run, the CLI does **not** create a new run — it triggers the named CI profile for the existing one. With no `--filter` at launch, the server greps the run's own stored scope, so you don't have to repeat the filter. You can still pass a fresh `--filter` (or `--remote-param`) at launch to override the scope or CI config.

This is the recommended two-phase flow. Choosing the profile at launch (rather than at prepare time) means the same prepared run can be launched on different CI profiles — e.g. retried on a second profile.

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

Testomat.io reporter automatically uploads artifacts during run. However, either some artifacts failed to upload or you intentionally disabled file upload during tests to speed up reporting. In this case you can use this command to upload artifacts after the run.

**Usage:**

```bash
npx @testomatio/reporter upload-artifacts [jsonl-file] [options]
```

**Arguments:**

- `jsonl-file` (optional) - Path to JSONL debug file to upload artifacts from. When provided, artifacts are loaded from the debug file instead of local temp storage.

**Environment Variables:**

- `TESTOMATIO`: Your Testomat.io API key (required).
- `TESTOMATIO_RUN`: The previous run ID you want to upload artifacts (optional). If none set, latest run will be used.
- `TESTOMATIO_URL`: Testomat.io server URL (optional, defaults to `https://app.testomat.io`).

**Options:**

- `--force`: Re-upload artifacts even if they were uploaded before.
- `--env-file <envfile>`: Load environment variables from a specific env file.

You still need [S3 artifacts configuration](./artifacts.md) to be set to upload artifacts to storage. In order to disable artifacts upload during tests you can use `TESTOMATIO_DISABLE_ARTIFACTS=1` while running tests.

**Upload from local temp storage (default mode):**

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

**Upload from JSONL debug file:**

You can upload artifacts from a JSONL debug file generated during test execution with `TESTOMATIO_DEBUG=1`. This mode reads artifact paths from the debug file and uploads them to the correct tests.

```bash
# Run tests with debug mode enabled
TESTOMATIO=tstmt_* TESTOMATIO_DEBUG=1 npx playwright test

# Upload artifacts from the debug file
TESTOMATIO=tstmt_* npx @testomatio/reporter upload-artifacts ./testomatio.debug.json
```

This approach is useful when:
- You need to re-upload artifacts after a failed upload
- You want to upload artifacts to a different run
- The original upload was skipped due to size limits

**Notes:**
- The JSONL file must contain a valid `runId` and tests with `test_id` set
- **CodeceptJS only**: trace.zip and video files are automatically recorded when using `TESTOMATIO_DEBUG=1`
- Test-level `files` are uploaded to the test artifacts tab; `steps[].artifacts` are uploaded back into their corresponding steps

### 6. replay

The `replay` command allows you to re-send test data from debug files to Testomat.io. This is useful when your original test run failed to upload results properly.

**Important:** To make replay work, tests should be executed with `DEBUG=1` variable set, to ensure they are running in debug mode and save data into a file.

**Usage:**

```bash
npx @testomatio/reporter replay [debug-file] [options]
```

**Arguments:**

- `debug-file` (optional) - Path to debug file. Defaults to `./testomatio.debug.json`.

**Options:**

- `--dry-run` - Preview the data without sending to Testomat.io
- `--env-file <envfile>` - Load environment variables from env file

**Examples:**

```bash
# run playwright tests and store debug information
TESTOMATIO=<your-api-key> DEBUG=1 npx playwright test

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

The replay command uses the `Replay` class (located in `src/replay.js`) to:

1. Parse the debug file line by line
2. Extract environment variables, run parameters, test data, and finish parameters
3. Restore environment variables (without overriding existing ones)
4. Create a new test run using the TestomatClient
5. Send each test result individually
6. Update the run status when complete

For more details about debug files, see the [Debug Pipe documentation](pipes/debug.md).

## The `--format` flag

`--format` switches a command into **machine-readable mode**: `stdout` carries only the requested data so it can be captured or piped, while the banner and progress logs are routed to `stderr`. Two commands support it — [`run --filter-list`](#3-run) and [`start`](#1-start) — and machine-readable mode behaves the same way for both.

**What machine-readable mode does (regardless of command or value):**

- The startup banner is **not** printed.
- Informational logs are routed to `stderr` (info level is lowered to `WARN`); only the requested payload is written to `stdout`.
- Warnings and errors still go to `stderr`, so a captured `stdout` stays clean.
- Set `TESTOMATIO_LOG_LEVEL=INFO` to bring progress logs back (on `stderr`) for debugging.

This is what makes `$( … )` capture and `|` piping reliable — without `--format`, the banner and `[TESTOMATIO]` logs are interleaved on `stdout`.

### With `run --filter-list`

Prints the IDs of the tests matching the filter **without running them**. `--format` only takes effect together with `--filter-list`; the value selects the encoding:

| Value     | Output                        | Example              |
| --------- | ----------------------------- | -------------------- |
| `ids`     | comma-separated (default)     | `T1,T2,S3`           |
| `grep`    | alternation wrapped in parens | `(T1\|T2\|S3)`       |
| `json`    | JSON array                    | `["T1","T2","S3"]`   |
| `newline` | one ID per line               | `T1` / `T2` / `S3`   |

**Exit codes:** `0` when at least one test matched, `1` when nothing matched or filter resolution failed — so CI can branch on `$?` and skip launching the runner when there is nothing to run.

```bash
# Feed the selection straight into a runner's grep flag
GREP=$(npx @testomatio/reporter run --filter-list "coverage:file=coverage.yml" --format grep)
[ -n "$GREP" ] && npx playwright test --grep "$GREP"

# Capture the IDs as JSON for further processing
npx @testomatio/reporter run --filter-list "coverage:file=coverage.yml" --format json > affected-tests.json
```

Only the `testomatio:` and `coverage:` filter pipes are supported (see [3.1 Filter pipes](#31-filter-pipes)). The [Coverage Pipe docs](./pipes/coverage.md#machine-readable-output-with---format) cover the formats in more detail.

### With `start`

Prints **only the new run id** to `stdout`, so it can be captured directly:

```bash
RUN_ID=$(npx @testomatio/reporter start --format id)
echo "$RUN_ID"   # e.g. a1b2c3d4
```

`start` emits a single value (the run id), so for `start` the format **value is not significant** — `--format id` is the conventional choice, but any value turns on machine-readable mode. `start` exits non-zero if the run could not be created, so `RUN_ID` is set only on success. It combines with `--kind` and `--filter`:

```bash
RUN_ID=$(npx @testomatio/reporter start --kind manual --format id)
RUN_ID=$(npx @testomatio/reporter start --filter "testomatio:tag-name=smoke" --format id)
```

### Quick reference

| Command             | Accepted `--format` values       | `stdout` contains      | Needs                |
| ------------------- | -------------------------------- | ---------------------- | -------------------- |
| `run --filter-list` | `ids`, `grep`, `json`, `newline` | the matching test IDs  | `--filter-list`      |
| `start`             | any (use `id`)                   | the new run id         | —                    |

## Environment Variables

Many commands rely on environment variables. You can set these in a command line, in a `.env` file, or use the `--env-file` option to specify a custom env file. Important variables include:

- `TESTOMATIO`: Your Testomat.io API key.
- `TESTOMATIO_RUN`: The current run ID (usually set automatically by the `start` command).
- `TESTOMATIO_TITLE`: Title for the test run (optional).
- `TESTOMATIO_STACK_ARTIFACTS`: Save large stack traces and steps as artifacts to avoid API size limits.
- [more..](./configuration.md)

## Tips

1. Always ensure your Testomat.io API key is properly set before running commands.
2. Use the `--env-file` option when you have different configurations for various environments.
3. The `run` command is versatile and can be used with various test runners like Jest, Mocha, or custom scripts.
4. When using the `xml` command, ensure your XML reports are in a supported format.
5. The `upload-artifacts` command is useful for adding additional files or logs to your test runs.

For more detailed information or troubleshooting, please refer to the Testomat.io documentation or contact support.
