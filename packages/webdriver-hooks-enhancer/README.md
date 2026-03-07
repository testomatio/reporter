# @testomatio/webdriver-hooks-enhancer

Enhanced WebdriverIO hook failure handling for Testomatio reporter.

## Problem

When a `beforeEach` hook fails in WebdriverIO:

- The hook fails and stops execution
- Remaining tests in the suite are skipped
- Skipped tests are NOT reported to Testomatio
- Incomplete test reports

## Solution

This package ensures ALL tests in the suite are reported as failed when the `beforeEach` hook fails.

## Installation

```bash
npm install @testomatio/webdriver-hooks-enhancer
```

## Usage

Enable in your `wdio.conf.js`:

```javascript
export const config = {
  reporters: [
    [
      'testomatio',
      {
        apiKey: process.env.TESTOMATIO,
        enableHooksEnhancer: true, // Enable enhanced hook handling
      },
    ],
  ],
};
```

## Example

```javascript
describe('User Auth', () => {
  beforeEach(async () => {
    throw new Error('Setup failed');
  });

  it('test 1', async () => {});
  it('test 2', async () => {});
  it('test 3', async () => {});

  // Also supports parametrized tests
  const users = ['admin', 'user', 'guest'];
  users.forEach(user => {
    it(`tests for ${user}`, async () => {});
  });
});
```

**Without package**: 0-1 tests reported
**With package**: All tests reported as failed (including parametrized)

## How It Works

1. Tracks `beforeEach` hook failures per suite
2. Parses spec files using AST to find all test titles
3. Reports all tests (including skipped) as failed when `beforeEach` fails

## Requirements

- WebdriverIO v7+ or v8+
- Node.js 18+

## License

MIT
