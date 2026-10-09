## Testomat.io Markdown Pipe

The Markdown Pipe generates a single, self-contained Markdown report from your test run. The report renders well on GitHub, GitLab, Bitbucket, and any Markdown viewer, which makes it convenient for PR comments, job summaries, and Slack snippets.

### Prerequisites

**🔌 The Markdown Pipe runs even without a `TESTOMATIO` API key.** Setting `TESTOMATIO_MARKDOWN_REPORT_SAVE=1` is enough to enable it:

```
TESTOMATIO_MARKDOWN_REPORT_SAVE=1 <actual run command>
```

### Enabling Markdown Reports

Set the following environment variables to control output:

- `TESTOMATIO_MARKDOWN_REPORT_SAVE=1` — enables the pipe.
- `TESTOMATIO_MARKDOWN_REPORT_FOLDER` — folder for the Markdown report. Default: `md-report`.
- `TESTOMATIO_MARKDOWN_FILENAME` — file name for the Markdown report. Default: `testomatio-report.md`.
- `TESTOMATIO_TITLE` — overrides the document title. Default: `Test Results`.

_The filename must end with `.md`. If the extension is missing, the report is saved with the default name `testomatio-report.md`._

### Report Layout

The Markdown report includes:

- **Header** — title and overall run status.
- **Summary table** — totals for passed / failed / skipped / todo / flaky.
- **Run Metadata table** — status, run id, run URL, start time, duration, parallel flag.
- **Description** — Markdown content rendered when a description is set on the shared pipe store (e.g. by the Coverage pipe via `coverageDescription`, or via `runParams.description`).
- **Configuration** — when `client.createRun({ configuration: { ... } })` is called with a key/value object, the pipe renders it as a small table (e.g. `exploratory`, `browser`, `shard`).
- **Tests, grouped by suite** — each test renders as:
  - a meta table (Status, Retries, Duration, Test ID),
  - **Steps** as a bullet list (parsed from CodeceptJS-style `<br>`-joined strings or nested step trees),
  - **Message** as a blockquote,
  - **Stack Trace** and **Logs** as fenced code blocks,
  - **Artifacts** in a collapsible `<details>` block — images render inline, other files render as links.

Trace ZIPs are filtered out. Local files are linked using `file://` URLs; remote artifacts use the original URL.

### Usage

The Markdown Pipe runs as part of the test execution lifecycle. Once the run finishes, the pipe writes the report to the configured path.

#### Example Commands

📊 Generate a Markdown report without sending data to Testomat.io:

```
TESTOMATIO_MARKDOWN_REPORT_SAVE=1 npx codeceptjs run
```

📝 Generate a Markdown report and also report to Testomat.io:

- Output folder: `md-report/`
- Output file: `testomatio-report.md`

```
TESTOMATIO_MARKDOWN_REPORT_SAVE=1 TESTOMATIO={API_KEY} npx codeceptjs run
```

📂 Generate a Markdown report at a custom location:

```
TESTOMATIO_MARKDOWN_REPORT_SAVE=1 \
  TESTOMATIO_MARKDOWN_REPORT_FOLDER=output/reports \
  TESTOMATIO_MARKDOWN_FILENAME=run-summary.md \
  TESTOMATIO={API_KEY} npx codeceptjs run
```

### CI Integration

The single-file Markdown output is well-suited to CI summaries:

- **GitHub Actions** — append the report to the job summary:
  ```bash
  cat md-report/testomatio-report.md >> "$GITHUB_STEP_SUMMARY"
  ```
- **GitLab CI** — upload as an artifact and link from the job page, or post via the GitLab Pipe.
- **Pull Request comments** — paste or post the report body via the GitHub / GitLab / Bitbucket pipes.
