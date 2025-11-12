# Linking Tests

Link automated test results to multiple manual test cases and control how they appear in reports.

## What is Test Linking?

Test linking connects automated test execution with manual test case management. When you run an automated test, you can link it to related manual test cases that cover scenarios not easily automated.

## How Run Types Affect Reporting

The `--kind` option determines what appears in your test report and affects how stakeholders view your testing coverage.

### Automated Run (Default Behavior)

By default, Testomatio creates automated runs when you run your tests. This is what most users experience daily - it shows your automated test execution results and includes links to related manual test cases as references.
Manual test cases appear as linked items but are not counted as executed tests in the report.

This behavior keeps automated test as the main focus, and ensures that number of tests in report is the same as number of tests executed by a test framework.

### Manual Runs

Manual runs are used when you want to report only manual test case execution. The automated test is completely hidden from the report - only linked manual test cases appear.

This behavior is useful if automated test verifies status for manual test cases.
However, you don't want to see the automated test itself in the final report.

**Step 1: Create a manual run and capture Run ID**
```bash
RUN_ID=$(TESTOMATIO=tstmt_xxxx npx @testomatio/reporter start --kind manual | tail -n 1)
```

> To check RUN_ID is set run `echo $RUN_ID`. Command can be different depending on your shell (zsh, fish, powershell). Last line of `npx @testomatio/reporter start` output is the run ID.

This creates a manual run on Testomat.io and saves the run ID into the environment variable.

**Step 2: Run your automated tests**
```bash
TESTOMATIO=tstmt_xxxx TESTOMATIO_RUN=$RUN_ID npx playwright test
```
Your automated tests execute but will NOT appear in the final report. Only the manual test cases linked via `linkTest()` will be shown.

**Alternative: One-step approach**
```bash
TESTOMATIO=tstmt_xxxx npx @testomatio/reporter run "npx playwright test" --kind manual
```

### Mixed Runs

Mixed runs show both automated test execution results AND manual test case results as separate entities in the same report.


This behavior is needed when you want to see the most precise report of all automated tests and linked manual tests in one report.


**Step 1: Create a mixed run**
```bash
RUN_ID=$(TESTOMATIO=tstmt_xxxx npx @testomatio/reporter start --kind mixed | tail -n 1)
```

> To check RUN_ID is set run `echo $RUN_ID`. Command can be different depending on your shell (zsh, fish, powershell). Last line of `npx @testomatio/reporter start` output is the run ID.

This creates a mixed run on Testomat.io and saves the run ID into the environment variable.

**Step 2: Run your automated tests**
```bash
TESTOMATIO=tstmt_xxxx TESTOMATIO_RUN=$RUN_ID npx playwright test
```
Your automated tests execute and will appear in the report. Any manual test cases linked via `linkTest()` will also appear separately in the same report.

**Alternative: One-step approach**
```bash
TESTOMATIO=tstmt_xxxx npx @testomatio/reporter run "npx playwright test" --kind mixed
```

### When to Use Each Type

**Manual Run:** When you want to report only manual test case execution. The automated test is completely hidden from the report - only manual test cases appear. This is ideal when manual QA teams are executing test cases separately from automated testing and you want a clean view of manual testing progress without automated test noise.

**Mixed Run:** When you need comprehensive visibility. This shows both automated test execution results AND manual test case results as separate entities in the same report. It's perfect for stakeholder reporting, audit trails, or when you want to demonstrate complete test coverage across both automated and manual testing efforts.

## linkTest Function

Use `linkTest()` to connect automated tests to manual test cases:

```javascript
import { linkTest } from '@testomatio/reporter';

// Link to single manual test case
linkTest('T12345678');

// Link to multiple manual test cases
linkTest(['T12345678', 'T87654321', 'T11223344']);
```

## Example: Login Feature

### Manual Test Cases
- `T12345678` - Login with valid credentials
- `T87654321` - Login with invalid password
- `T11223344` - Login with empty username
- `T55667788` - Login with locked account
- `T99887766` - Login after session timeout

### Test Framework Examples

```javascript
// Playwright example
import { test, expect } from '@playwright/test';
import { linkTest } from '@testomatio/reporter';

test.describe('Authentication', () => {
  test('user login functionality', async ({ page }) => {
    // Link this automated test to related manual test cases
    linkTest(['T12345678', 'T87654321', 'T11223344', 'T55667788', 'T99887766']);

    // Your test implementation here
    await page.goto('/login');
    await page.fill('[data-testid="username"]', 'testuser');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await expect(page.locator('[data-testid="welcome-message"]')).toContainText('Welcome');
  });
});
```

```javascript
// CodeceptJS example
import { linkTest } from '@testomatio/reporter';

Feature('Authentication');

Scenario('user login functionality', ({ I }) => {
  // Link this automated test to related manual test cases
  linkTest(['T12345678', 'T87654321', 'T11223344', 'T55667788', 'T99887766']);

  // Your test implementation here
  I.amOnPage('/login');
  I.fillField('[data-testid="username"]', 'testuser');
  I.fillField('[data-testid="password"]', 'password123');
  I.click('[data-testid="login-button"]');
  I.see('Welcome', '[data-testid="welcome-message"]');
});
```


## Report Results

| Run Type | Automated Tests | Manual Tests | Total in Report |
|----------|-----------------|--------------|-----------------|
| Automated | 1 (with links) | 0 | 1 |
| Manual | 0 | 5 | 5 |
| Mixed | 1 | 5 | 6 |

## Use Case

Your automated test verifies the main login flow (T12345678), while manual testers handle edge cases that are difficult to automate (invalid credentials, locked accounts, etc.). Mixed runs give stakeholders visibility into both automated execution and manual testing coverage in a single report.
