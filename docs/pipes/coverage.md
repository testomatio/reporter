## Coverage Pipe

The **Coverage Pipe** allows you to dynamically filter tests based on actual code changes and a coverage report. It uses Git diff and a coverage file to detect which tests are impacted by modified files, so you only run what's necessary.

This is useful for:
- Running only tests related to recent changes (faster CI)
- Saving compute time in large test suites
- Testing hotfixes or feature branches with precision

## Coverage Pipe Functionality preset

1. A valid **coverage file** (see example below).
2. A **Git diff target** branch to compare against (optional, defaults to `master`).

Simple command usage:

```bash
--filter "coverage:file=<path_to_coverage.yml>[,diff=<git_branch>]"
```
_(more commands you can find below in this file)_


## 📄 Example Coverage File Format (we use "coverage.yml" as default one)

The coverage file defines mappings between changed source files and the tests or tags associated with them. This allows the Coverage Pipe to determine which tests to run based on file changes in Git.

✅ Sample coverage.yml

```yaml
src/Auth/*.tsx:
  - "@S171a8"
  - "tag:@auth"

src/Admin/**:
  - "@T0922"

src/Checkout/**/*.tsx:
  - "tag:@checkaut"
```

_(For now we cover only cases where suiteid/testid/tag can be used as coverage values)_

### 🧠 How It Works

* Each key is a glob pattern or file path that matches changed files.
* Each value is a list of:
-- Test IDs (e.g., @T091e)
-- Suite IDs (e.g., @S171a8)
-- Tag references (e.g., tag:@smoke)

**When a file matches a key, the corresponding tests are included in the run**

### 💡 Tips

* Use **/*.js patterns to cover folders or extensions.
* You can mix test IDs and tags freely.
* Multiple patterns can map to the same test or tag.

---

## 📘 Usage Examples

### Retrieve a list of tests matching your filter (without running them):
_If you want to check which tests match your filter without executing the test runner, use the `--filter-list` option_

This is useful for:
- debugging your filter expression
- confirming which tests the server will return
- CI pipelines that only need to inspect affected tests

**Examples:**

```bash
npx @testomatio/reporter run --filter-list "coverage:file=coverage.yml"
```

with a branch comparison:

```bash
npx @testomatio/reporter run --filter-list "coverage:file=coverage/coverage.yml,diff=develop"

```

### Machine-readable output with `--format`

`--filter-list` always prints the matched test IDs to `stdout` in a format suitable for piping. The CLI banner is suppressed, progress logs are silenced, and any remaining warnings/errors go to `stderr` — so the terminal shows only the test list, and the output is safe to copy or capture. The default format is `ids` (comma-separated); use `--format` to switch.

Set `TESTOMATIO_LOG_LEVEL=INFO` to bring the progress logs back for debugging.

Supported values:

| Format    | Output                                  | Example                       |
| --------- | --------------------------------------- | ----------------------------- |
| `grep`    | Alternation pattern wrapped in `(...)`  | `(t1234abcd\|t5678efgh)`      |
| `json`    | JSON array of IDs                       | `["t1234abcd","t5678efgh"]`   |
| `newline` | One ID per line                         | `t1234abcd\nt5678efgh`        |
| `ids`     | Comma-separated IDs (default behaviour) | `t1234abcd,t5678efgh`         |

**Example: feed matched tests into a runner's grep flag**

```bash
GREP=$(npx @testomatio/reporter run --filter-list "coverage:file=coverage.yml" --format grep)
npx playwright test --grep "$GREP"
```

**Example: capture IDs as JSON for further processing**

```bash
npx @testomatio/reporter run --filter-list "coverage:file=coverage.yml" --format json > affected-tests.json
```

### Run tests based on changed files _(by the default `master` Git branch)_:

**Example:**

```bash
npx @testomatio/reporter run "npx jest" --filter "coverage:file=coverage.yml"
```

* Compare changes to a specific Git branch

**Example:**

```bash
npx @testomatio/reporter run "npx jest" --filter "coverage:file=coverage/coverage.yml,diff=develop"
```

### ⚠️ Error Scenarios

* Missing or misspelled coverage file
```bash
npx @testomatio/reporter run "npx jest" --filter "coverage:file=no-exist.yml"
#  Error case =>>> ❌ Coverage file not found: no-exist.yml
```

* Invalid Git branch
```bash
npx @testomatio/reporter run "npx jest" --filter "coverage:file=coverage.yml,diff=no-such-branch"
#  Error case =>>> ❌ Git command failed: git diff no-such-branch --name-only
```

* Missing "file" param
```bash
npx @testomatio/reporter run "npx jest" --filter "coverage:diff=main"
#  Error case =>>> 🚫 Missing required parameter: "file"
```

### 🧪 Git & Coverage Integration Details

| **Option**                                           | **Git Command Used**                  | **Notes**            |
| ---------------------------------------------------- | ------------------------------------- | -------------------- |
| `--filter "coverage:file=coverage.yml,diff=feature"` | ✅ `git diff feature --name-only`      | Compare to `feature` |
| `--filter "coverage:file=coverage.yml"`              | ✅ `git diff master --name-only`       | Defaults to `master` |
| `--filter "coverage:diff=master,file=coverage.yml"`  | ✅ `git diff master --name-only`       | Order doesn't matter |
| `--filter "coverage:file=coverage.yml,diff=noexist"` | ❌ Git diff fails                      | Invalid branch       |
| `--filter "coverage:file=no-exist.yml"`              | ❌ Coverage file not found             | File doesn't exist   |
| `--filter "coverage:filepath=coverage.yml"`          | 🚫 Missing required parameter: "file" | Invalid key          |

### 🧠 How It Works

**Under the hood, the Coverage Pipe:**

1) Parses Git diff output to find changed files.
2) Loads the coverage report to map files to test identifiers.
3) Matches changed files to impacted tests.
4) Returns a test ID list to be executed.
5) If the pipe cannot match any tests:
* You’ll see: `ℹ️ No matching entries in coverage file for provided Git changes.`
* If no tests are found: `ℹ️ No tests found for execution based on Git changes.`

---

ℹ️ Looking for more dynamic and fast test execution in CI? The Coverage Pipe is your best starting point 👍.
