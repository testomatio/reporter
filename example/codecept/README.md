# CodeceptJS Example with Testomat.io Reporter

This example demonstrates how to use the Testomat.io reporter with CodeceptJS tests.

## Setup

1. Install dependencies:
```bash
npm install
```

## Running Tests

### Basic test run:
```bash
npm run test:simple
```

### Run with Testomat.io reporter (requires API key):
```bash
TESTOMATIO=your-api-key npm run test:simple
```

### Create tests in Testomat.io:
```bash
TESTOMATIO=your-api-key TESTOMATIO_CREATE=1 npm run test:simple
```

### Use custom working directory for relative paths:
```bash
TESTOMATIO=your-api-key TESTOMATIO_CREATE=1 TESTOMATIO_WORKDIR=/path/to/project npm run test:simple
```

## Test Files

- **simple_test.js**: Basic test scenarios including:
  - Passing test with simple assertion
  - Failing test with intentional failure

## Configuration

The `codecept.conf.js` is configured to use the Testomat.io reporter through the testomat plugin. Key features:

- **CommonJS**: Uses `module.exports` format for compatibility
- **No Browser Dependencies**: Uses FileSystem helper instead of Puppeteer for simplicity
- **Testomat Plugin**: Configured to use the local adapter

## Package Configuration

The `package.json` is configured as CommonJS (`"type": "commonjs"`) to ensure compatibility with the reporter's ESM format.

## Features Demonstrated

1. **Basic Test Execution**: Simple passing and failing scenarios
2. **Plugin Integration**: Using testomat plugin with CodeceptJS
3. **File Path Handling**: Relative paths for cleaner reporting
4. **Error Handling**: Proper failure reporting

## Note

This example currently demonstrates basic CodeceptJS integration. For advanced features like annotation metadata and debug pipe integration, the CodeceptJS adapter may need additional enhancements to match the Playwright adapter capabilities.