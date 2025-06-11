# Playwright Example with Testomat.io Reporter

This example demonstrates how to use the Testomat.io reporter with Playwright tests.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Install Playwright browsers:
```bash
npx playwright install
```

## Running Tests

### Basic test run:
```bash
npm test
```

### Run with Testomat.io reporter (requires API key):
```bash
TESTOMATIO=your-api-key npm test
```

### Create tests in Testomat.io:
```bash
TESTOMATIO=your-api-key TESTOMATIO_CREATE=1 npm test
```

### Use custom working directory for relative paths:
```bash
TESTOMATIO=your-api-key TESTOMATIO_CREATE=1 TESTOMATIO_WORKDIR=/path/to/project npm test
```

## Test Files

- **sample.spec.js**: Demonstrates various test annotations and scenarios including:
  - Passing test with issue annotation
  - Failing test with bug annotation  
  - Test with multiple custom annotations
  - Skipped test
  - Slow test with built-in annotation

- **example.spec.js**: Basic test suite with:
  - Simple passing test
  - Intentionally failing test
  - Test with custom steps

## Features Demonstrated

1. **Test Annotations**: Custom metadata attached to tests
2. **Relative File Paths**: Using TESTOMATIO_WORKDIR for cleaner paths
3. **Test Creation**: Auto-creating tests in Testomat.io with TESTOMATIO_CREATE=1
4. **Multiple Test Status**: Passing, failing, and skipped tests
5. **Test Steps**: Organized test execution with custom steps

## Configuration

The `playwright.config.js` is configured to use the Testomat.io reporter alongside the HTML reporter. It includes multiple browser projects (chromium, firefox, webkit) to demonstrate cross-browser testing.