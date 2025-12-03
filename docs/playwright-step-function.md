# Playwright Step Function

The `step()` function now works with Playwright! This resolves [GitHub issue #637](https://github.com/testomatio/reporter/issues/637).

## 🎯 Problem

Previously, `step()` didn't work with Playwright:

```javascript
import { step } from '@testomatio/reporter';
import { test } from '@playwright/test';

test('my test', async () => {
  step('This throws error'); // ❌ "This function is not available in Playwright framework"
});
```

## ✅ SOLUTION

Import step from the special module and set the test context:

```javascript
import { test } from '@playwright/test';
import { setTestStep, step } from '@testomatio/reporter/playwright/step.js';

test('my test', async ({ page }, testInfo) => {
  setTestStep(testInfo.step); // 🎯 KEY: Set test.step context

  step('Step 1: Using Testomat step'); // ✅ Now works!

  // Or with function (like test.step)
  await step('Step 2: Complex operation', async () => {
    await page.click('#button');
    return 'Done';
  });
});
```

## 🛠️ API

### `setTestStep(testStepFunction)`
**Required**: Sets the Playwright `test.step` function context.
```javascript
setTestStep(testInfo.step);
```

### `step(title, [fn])`
- `title` (string) - Step title
- `fn` (function, optional) - Function to execute inside the step

**Examples:**

```javascript
// Simple step (logged)
step('Login user');

// Step with function
await step('Fill form', async () => {
  await page.fill('#name', 'John');
  await page.fill('#email', 'john@test.com');
});
```

## 🔄 Before → After

**Before:**
```javascript
// ❌ Didn't work
import { step } from '@testomatio/reporter';
step('My step'); // Error!
```

**After:**
```javascript
// ✅ Works!
import { setTestStep, step } from '@testomatio/reporter/playwright/step.js';

test('my test', async ({ page }, testInfo) => {
  setTestStep(testInfo.step); // 🎯 Set context
  step('My step'); // Success!
});
```

## ⚙️ Configuration

In `playwright.config.ts`:

```javascript
export default {
  reporter: [
    ['@testomatio/reporter/playwright', {
      apiKey: process.env.TESTOMATIO,
    }]
  ],
};
```

## 🚀 Benefits

✅ **Unified API** - `step(title, fn?)` across all frameworks (Playwright uses a dedicated entrypoint and `setTestStep(testInfo.step)`).
✅ **Native Integration** - Uses Playwright's built-in `test.step()`
✅ **Easy Migration** - Just add `setTestStep(testInfo.step)`
✅ **Full Compatibility** - Works with existing code
✅ **Real Step Creation** - Creates actual Playwright steps

## 🎯 COMPLETE WORKING EXAMPLE

```javascript
import { test, expect } from '@playwright/test';
import { setTestStep, step } from '@testomatio/reporter/playwright/step.js';

test.describe('GitHub Issue #637 - SOLVED', () => {
  test('Complete working example', async ({ page }, testInfo) => {
    setTestStep(testInfo.step); // 🎯 SET CONTEXT

    try {
      // ✅ Simple step
      step('Step 1: User login');

      // ✅ Step with function
      await step('Step 2: Fill form', async () => {
        await page.fill('#username', 'user');
        await page.fill('#password', 'pass');
      });

      // ✅ Nested steps
      await step('Step 3: Complex operation', async () => {
        step('Sub-step 1');
        await step('Sub-step 2', async () => {
          // Your code here
        });
      });

      expect(true).toBe(true);

    } finally {
      // Context will be overwritten on the next test,
      // but you can also reset it manually:
      // clearTestStep();
    }
  });
});
```

## 🐛 Troubleshooting

### Error: "setTestStep is not defined"
```javascript
// ❌ Wrong import
import { step } from '@testomatio/reporter/playwright/step.js';

// ✅ Correct import
import { setTestStep, step } from '@testomatio/reporter/playwright/step.js';
```

### Error: "Step function requires test.step to be set"
```javascript
// ❌ Forgot to set context
step('My step');

// ✅ Set context first
setTestStep(testInfo.step);
step('My step');
```

## 🎉 Ready to Use!

Now you have unified API for steps across all frameworks:

- **Jest:** `import { step } from '@testomatio/reporter'`
- **Mocha:** `import { step } from '@testomatio/reporter'`
- **Playwright:** `import { setTestStep, step } from '@testomatio/reporter/playwright/step.js'`

**GitHub issue #637 is completely resolved!** 🎉

## 🏆 Key Innovation

The solution works by:
1. **Capturing `test.step` function** from Playwright test context
2. **Storing it globally** via `setTestStep()`
3. **Reusing it** in Testomatio's `step()` function
4. **Creating real Playwright steps** with full reporting support

This gives you the best of both worlds: Testomatio's unified API + Playwright's native step functionality!