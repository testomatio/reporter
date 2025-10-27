## Coverage Pipe

![](./images/coverage.png)

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
todomvc-tests/helpers/**:
  - "@S171a8"
  - "@T091e"
  - "tag:@smoke"

todomvc-tests/edit-todos_test.js:
  - "@T0922"

todomvc-tests/pages/**/*.js:
  - "tag:@step-06"
  - "@Safa7"
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

* Run tests related to changed files using coverage data by the default `master` Git branch
```bash
npx @testomatio/reporter run "npx jest" --filter "coverage:file=coverage.yml"
```

* Compare changes to a specific Git branch
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
