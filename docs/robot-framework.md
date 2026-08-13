# Robot Framework

The [`robot-framework-reporter`](https://github.com/testomatio/robot-framework-reporter) plugin integrates Robot Framework with Testomat.io. It can import tests and report test execution results in real time.

## Requirements

- Python 3.10 or newer
- Robot Framework 4.0 or newer
- A Testomat.io project API key

## Installation

Install the plugin with pip:

```bash
pip install robot-framework-reporter
```

If your system has both Python 2 and Python 3, use `pip3`:

```bash
pip3 install robot-framework-reporter
```

## Get a project API key

1. Sign in to Testomat.io.
2. Create a project or open an existing one.
3. Select **Import from Source Code**.
4. Copy the project API key. It starts with `tstmt_`.

## Import tests

Use the `Testomatio.Import` listener to import Robot Framework tests into Testomat.io:

```bash
TESTOMATIO=tstmt_xxxxxxxx robot --listener Testomatio.Import path/to/tests
```

After import, Testomat.io assigns a Test ID to each test.

### Preserve existing Test IDs

To import tests with their existing Test IDs into another project, enable the `create` option:

```bash
TESTOMATIO=tstmt_xxxxxxxx robot --listener Testomatio.Import:create=1 path/to/tests
```

### Keep the source structure

To preserve the suite and folder structure from the source code, enable the `structure` option:

```bash
TESTOMATIO=tstmt_xxxxxxxx robot --listener Testomatio.Import:structure=1 path/to/tests
```

## Report test results

Use the `Testomatio.Report` listener to run tests and send their results to Testomat.io:

```bash
TESTOMATIO=tstmt_xxxxxxxx robot --listener Testomatio.Report path/to/tests
```

The listener creates a test run in Testomat.io and uploads results after each test suite completes.

## Configuration

Both listeners support these environment variables:

| Variable | Description | Default |
| --- | --- | --- |
| `TESTOMATIO` | Testomat.io project API key | Required |
| `TESTOMATIO_URL` | Testomat.io server URL | `https://app.testomat.io` |
| `TESTOMATIO_REQUEST_INTERVAL` | Interval between requests in seconds | `5` |
| `TESTOMATIO_MAX_REQUEST_FAILURES` | Maximum number of attempts to send a request | `5` |

The report listener also supports:

| Variable | Description | Default |
| --- | --- | --- |
| `TESTOMATIO_RUN` | ID of an existing test run | A new run is created |
| `TESTOMATIO_TITLE` | Test run title | None |
| `TESTOMATIO_RUNGROUP_TITLE` | Run group title | None |
| `TESTOMATIO_PUBLISH` | Publish the run and generate a public URL | `False` |
| `TESTOMATIO_DISABLE_BATCH_UPLOAD` | Upload each result separately | `False` |
| `TESTOMATIO_BATCH_SIZE` | Number of results uploaded in a batch, up to 100 | `50` |

For all available import and reporting options, see the [`robot-framework-reporter` documentation](https://github.com/testomatio/robot-framework-reporter).
