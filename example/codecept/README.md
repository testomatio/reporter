# CodeceptJS Test Project for Testomatio Reporter

This is a comprehensive test project designed to test the Testomatio reporter adapter for CodeceptJS, specifically targeting CodeceptJS 3.7+ features.

## Project Structure

```
codecept/
├── README.md                    # This file
├── codecept.conf.js            # CodeceptJS configuration with Testomatio adapter
├── package.json                # Dependencies
├── simple_test.js              # Basic passing/failing tests
├── comprehensive_test.js       # Comprehensive test scenarios
├── hooks_test.js              # Before/After hook testing
├── failing_hooks_test.js      # Tests with failing hooks
├── aftersuite_bug_demo_test.js     # Demonstrates AfterSuite failure bug (#948)
├── beforesuite_bug_demo_test.js    # Demonstrates BeforeSuite failure behavior
└── steps_file.js              # Step definitions
```

## Test Categories

### 1. Basic Tests (`simple_test.js`)

- ✅ Test that passes
- ❌ Test that fails

### 2. Comprehensive Tests (`comprehensive_test.js`)

- ✅ Passing tests
- ❌ Failing tests
- ⏭️ Skipped tests
- 📊 Data-driven tests with examples
- 🔄 Multi-step tests
- ⚡ Async tests
- 💥 Tests with exceptions

### 3. Hook Tests (`hooks_test.js`)

- 🔧 BeforeSuite/AfterSuite execution
- 🎯 Before/After test execution
- 📊 Hook execution order verification
- ⏭️ Skipped tests with hooks

### 4. Failing Hook Tests (`failing_hooks_test.js`)

- 💥 Tests where Before hooks fail
- 💥 Tests where After hooks fail
- 🔄 Recovery after hook failures

### 5. Bug Demonstration Files

- 🐛 `aftersuite_bug_demo_test.js` - **Reproduces Issue #948**: AfterSuite failure incorrectly marks all passing tests as failed
- 🐛 `beforesuite_bug_demo_test.js` - BeforeSuite failure behavior testing

## Test Features

### Test Object Injection and Expect Helper

All test scenarios use proper patterns:

```javascript
// Regular scenario with Expect helper
Scenario('Test name', ({ I, test }) => {
  console.log('Current test:', test.title);
  I.expectEqual(2 + 2, 4);
  I.expectTrue(true);
  I.expectContain('hello world', 'world');
});

// Data-driven scenario
Data(['data1', 'data2']).Scenario('Data test', ({ I, current }) => {
  I.expectEqual(current, current);
});
```

### Feature Tags

Tests include feature-level tags for organization:

- `@comprehensive` - Core test functionality
- `@hooks` - Hook execution testing
- `@failing-hooks` - Hook failure scenarios

## Running Tests

### Run All Tests

```bash
npx codeceptjs run
```

### Run Specific Test Categories

```bash
# Comprehensive tests only
npx codeceptjs run comprehensive_test.js

# Hook tests only
npx codeceptjs run hooks_test.js

# Failing hook tests only
npx codeceptjs run failing_hooks_test.js

# Bug demonstration files
npx codeceptjs run aftersuite_bug_demo_test.js    # Issue #948
npx codeceptjs run beforesuite_bug_demo_test.js
```

### Run with Testomatio Reporting

```bash
TESTOMATIO=your-api-key npx codeceptjs run
```

### Run with Debug Output

```bash
TESTOMATIO=your-api-key TESTOMATIO_DEBUG=1 npx codeceptjs run
```

## Expected Outcomes

When running these tests, you should expect:

### Passing Tests

- Basic math operations
- Async operations
- Tests with proper setup from hooks
- Data-driven tests with valid data
- Unicode and special character handling

### Failing Tests

- Intentional assertion failures
- Tests with incorrect expected values
- Tests affected by failing hooks
- Multiple assertion failures

### Skipped Tests

- Tests marked with `.skip()`
- Tests in skipped suites

### Reporter Verification

The Testomatio reporter should capture:

- ✅ Test status (passed/failed/skipped)
- ⏱️ Execution time
- 📝 Test titles and suite names
- 🏷️ Test IDs and tags
- 💾 Test metadata and context
- 🪜 Test steps and execution flow
- 🔧 Hook execution and failures
- 📊 Data examples for data-driven tests
- 💥 Error messages and stack traces

## Configuration Notes

- Uses `Expect` helper for assertions without browser dependencies
- Configured with Testomatio adapter pointing to `../../lib/adapter/codecept`
- Multiple execution configurations for different test categories
- CommonJS module format for compatibility
- No browser automation - focuses on pure assertion testing

## Troubleshooting

If tests don't run:

1. Ensure CodeceptJS 3.7+ is installed
2. Check that the Testomatio adapter path is correct
3. Verify environment variables are set
4. Check for missing dependencies

## Integration Testing

These tests are designed to work with the comprehensive unit tests in:

- `tests/adapter/codecept_comprehensive.test.js`

The unit tests will execute these scenarios and verify that the Testomatio adapter correctly captures and reports all test outcomes, hook executions, and edge cases.
