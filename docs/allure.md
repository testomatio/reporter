# Allure Reports Import

Import test results from [Allure](https://docs.qameta.io/allure-report/) format into Testomat.io. The reporter automatically parses Allure results, extracts test information, and creates tests in your project.

## Quick Start

Install the reporter:

```bash
npm install @testomatio/reporter --save-dev
```

Run your tests to generate Allure results, then import:

```bash
TESTOMATIO={API_KEY} npx @testomatio/reporter allure allure-results
```

You can pass:
- A folder path (e.g., `allure-results`)
- A glob pattern (e.g., `"allure-results/*-result.json"`)

The reporter automatically finds Allure result files (`*-result.json`) and container files (`*-container.json`) in the specified location.

## What Gets Imported

| Field | Source | Notes |
|-------|--------|-------|
| **Test Title** | `name` field | Test method name |
| **Status** | `status` field | passed, failed, broken → failed, skipped/pending |
| **Suite** | `suite` label | Suite title |
| **Epic** | `epic` label | Sent as link `{ label: "epic:Value" }` |
| **Feature** | `feature` label | Sent as link `{ label: "feature:Value" }` |
| **File** | `testClass` label + `language` | Source file name (e.g., `LoginTest.kt`) |
| **Code** | Source file | Fetched if file exists (see [Source Code](#source-code)) |
| **Steps** | `steps` array | Converted with category="user" |
| **Attachments** | `attachments` array | Uploaded as artifacts |
| **Parameters** | `parameters` array | Converted to `example` object |
| **Description** | `description` field | Mapped directly |
| **Message/Stack** | `statusDetails` | Error information from failed tests |

## Retry Deduplication

If a test was run multiple times (retries), results are combined into **1 test**. Tests are deduplicated by `historyId` - so 3 retry attempts of the same test count as **1 test**, not 3.

**Failure information is preserved**: If any retry attempt fails, all failure messages and stack traces from failed attempts are combined. The final status reflects the last attempt.

- If all attempts failed → combines all failure messages and stack traces
- If final attempt passed but earlier attempts failed → marked as failed with combined failure info

Console output shows the deduplication:
```
[TESTOMATIO] Found 4 result files and 0 container files
[TESTOMATIO] Processed 2 unique tests (from 4 result files)
```

## Command Options

```bash
npx @testomatio/reporter allure <pattern> [options]
```

| Option | Description |
|--------|-------------|
| `<pattern>` | Folder path or glob pattern (e.g., `allure-results` or `allure-results/*-result.json`) |
| `--with-package` | Keep full package path in file name (default: strip package) |
| `--java-tests <dir>` | Path to test source files for code fetching |
| `--lang <lang>` | Language for source code parsing (java, kotlin, python, ruby, etc.) |
| `--timelimit <sec>` | Kill process after N seconds if stuck |

## File Path Behavior

By default, only the class name is used as the file (e.g., `LoginTest.kt`).

With `--with-package`, the full package path is included:
```
com/example/app/tests/ui/LoginTest.kt
```

## Artifacts

Attachments (screenshots, videos, logs) from Allure results are uploaded as artifacts.

**Note**: Artifacts require S3-compatible storage to be configured. If S3 is not set up, attachments will be omitted from the report.

See [Artifacts documentation](./artifacts.md) for S3 configuration details.

## Source Code

Test code snippets are fetched from source files when available.

**Note**: Source code extraction requires access to test source files. Use `--java-tests <dir>` to specify the source directory. If source files are not accessible, code field will be empty.

## Examples

### Java / JUnit

```bash
mvn clean test
TESTOMATIO={API_KEY} npx @testomatio/reporter allure "target/allure-results/*-result.json" --lang java --java-tests src/test/java
```

### Kotlin / Android

```bash
./gradlew connectedAndroidTest
TESTOMATIO={API_KEY} npx @testomatio/reporter allure "build/allure-results/*-result.json" --lang kotlin
```

## Migration from Allure Report


### Migration Steps

1. **Keep Allure for test execution** - Continue using Allure in your test framework

2. **Add Testomat.io import** - Add one command to your CI pipeline to import Allure results:

```bash
npx @testomatio/reporter allure allure-results
```

3. **Configure S3 (optional)** - Set up S3 storage to enable artifact uploads

4. **Remove Allure report generation** - Once satisfied with Testomat.io reports, you can remove Allure HTML report generation step

5. **Enable PR comments** - Add `GH_PAT: ${{ github.token }}` to enable automatic PR comments with test results

### Comparison

**With Allure only:**
```bash
mvn test
allure generate allure-results
# Upload HTML report manually or share locally
```

**With Testomat.io:**
```bash
mvn test
npx @testomatio/reporter allure allure-results
# Automatic cloud report with history, PR comments, analytics
```

## Debugging

Enable debug mode to see detailed information:

```bash
DEBUG=@testomatio/reporter:* npx @testomatio/reporter allure "allure-results/*-result.json"
```

A debug file is created at `/tmp/testomatio.debug.latest.json` with the exact data sent to Testomat.io.


## GitHub Actions Workflow

Example workflow for Java/JUnit projects with Allure:

```yaml
name: CI with Allure

on:
  pull_request:
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up JDK
        uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'

      - name: Run tests
        run: mvn clean test

      - name: Import to Testomat.io
        run: npx @testomatio/reporter allure target/allure-results --lang java --java-tests src/test/java
        if: always()
        env:
          TESTOMATIO: ${{ secrets.TESTOMATIO }}
          TESTOMATIO_TITLE: 'PR ${{ github.event.number }}'
          # Optional: S3 for artifacts
          # S3_BUCKET: ${{ secrets.S3_BUCKET }}
          # S3_REGION: ${{ secrets.S3_REGION }}
          # S3_ACCESS_KEY_ID: ${{ secrets.S3_ACCESS_KEY_ID }}
          # S3_SECRET_ACCESS_KEY: ${{ secrets.S3_SECRET_ACCESS_KEY }}
```
