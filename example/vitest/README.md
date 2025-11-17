# Testomatio Vitest Example

This directory contains an example Vitest project configured to use the Testomat.io reporter.

## Setup

Install dependencies:

```bash
npm install
```

## Running Tests

Basic test run:

```bash
npm test
```

Watch mode:

```bash
npm run test:watch
```

With UI:

```bash
npm run test:ui
```

## Configuration

The reporter is configured in `vitest.config.js`:

```javascript
reporters: ['default', ['../../src/adapter/vitest.js', {}]];
```

## Environment Variables

- `TESTOMATIO` - Your Testomat.io API key
- `TESTOMATIO_DEBUG=1` - Enable debug output
- `TESTOMATIO_DISABLE_BATCH_UPLOAD=1` - Disable batch uploading
- `TESTOMATIO_CREATE=1` - Create new tests in Testomat.io if not found

## Example

```bash
TESTOMATIO=your_api_key TESTOMATIO_DEBUG=1 npm test
```
