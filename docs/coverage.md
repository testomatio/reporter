# Code Coverage Reporting

Testomat.io Reporter now supports code coverage reporting, allowing you to collect, upload, and display code coverage data alongside your test results.

## Features

- 📊 **Automatic Coverage Collection**: Collects coverage data from popular test frameworks
- 🗄️ **S3 Upload**: Uploads coverage reports (lcov, JSON, HTML) to your S3 bucket
- 📈 **Coverage Summary**: Displays line, branch, and function coverage percentages
- 🔗 **Integration**: Works seamlessly with existing Testomat.io reporter setup

## Supported Coverage Formats

The reporter can parse and upload:
- **LCOV** (`lcov.info`) - Standard coverage format
- **JSON** (`coverage-final.json`) - Istanbul/NYC coverage format
- **HTML Reports** (`lcov-report/` folder) - Human-readable coverage reports

## Configuration

To enable code coverage reporting, set the following environment variables:

### Required

- `TESTOMATIO_COVERAGE=1` - Enable coverage reporting

### Optional

- `TESTOMATIO_COVERAGE_FOLDER=<path>` - Path to coverage folder (default: `coverage`)

### S3 Configuration (for uploads)

Coverage files are uploaded to S3 using the same configuration as test artifacts:

- `S3_BUCKET` - Your S3 bucket name
- `S3_REGION` - AWS region
- `S3_ACCESS_KEY_ID` - S3 access key
- `S3_SECRET_ACCESS_KEY` - S3 secret key
- `S3_ENDPOINT` - S3 endpoint (for non-AWS providers)

See [Artifacts documentation](./artifacts.md) for detailed S3 configuration.

## Usage

### With Jest

```bash
# Generate coverage and report it
TESTOMATIO=<api_key> TESTOMATIO_COVERAGE=1 npm test -- --coverage
```

### With Vitest

```bash
# Generate coverage and report it
TESTOMATIO=<api_key> TESTOMATIO_COVERAGE=1 npm test -- --coverage
```

### With Playwright

```bash
# Configure playwright.config.ts to collect coverage
# Then run tests with coverage reporting enabled
TESTOMATIO=<api_key> TESTOMATIO_COVERAGE=1 npx playwright test
```

### With Mocha + NYC

```bash
# Run tests with nyc for coverage
TESTOMATIO=<api_key> TESTOMATIO_COVERAGE=1 npx nyc mocha
```

### With CodeceptJS + NYC

```bash
# Run tests with nyc wrapper
TESTOMATIO=<api_key> TESTOMATIO_COVERAGE=1 npx nyc codeceptjs run
```

## How It Works

1. **Run Tests with Coverage**: Use your test framework's coverage tool to generate coverage data
2. **Reporter Collects**: After tests complete, the reporter automatically detects and parses coverage files
3. **Upload to S3**: Coverage files (lcov, JSON, HTML) are uploaded to your S3 bucket
4. **Display on Testomat.io**: Coverage data is associated with your test run and displayed on the platform

## Example Output

When coverage reporting is enabled, you'll see output like:

```
[TESTOMATIO] Collecting code coverage...
[TESTOMATIO] Coverage summary:
[TESTOMATIO]   Lines: 85.5% (342/400)
[TESTOMATIO]   Branches: 78.2% (156/200)
[TESTOMATIO]   Functions: 90.0% (45/50)
[TESTOMATIO]   Files: 25
[TESTOMATIO] ✓ Coverage data collected
[TESTOMATIO] Uploading coverage files...
[TESTOMATIO] ✓ 3 coverage files uploaded
[TESTOMATIO] Coverage report: https://s3.amazonaws.com/.../coverage/html/index.html
```

## Custom Coverage Folder

If your coverage files are in a non-standard location:

```bash
TESTOMATIO=<api_key> \
  TESTOMATIO_COVERAGE=1 \
  TESTOMATIO_COVERAGE_FOLDER=my-coverage \
  npm test
```

## What Gets Uploaded

When coverage is enabled and S3 is configured:

1. **lcov.info** - Raw coverage data (if present)
2. **coverage-final.json** - JSON coverage data (if present)
3. **HTML Report** - All HTML files from the coverage report (if present)

The main HTML coverage report (index.html) URL will be logged to the console.

## Troubleshooting

### Coverage folder not found

Make sure your test framework is generating coverage before the reporter runs:

```bash
# For Jest/Vitest
npm test -- --coverage

# For NYC
npx nyc npm test
```

### Coverage not uploaded

Verify S3 credentials are configured:

```bash
# Check if S3 is enabled
S3_BUCKET=my-bucket npm test
```

See [Artifacts documentation](./artifacts.md) for S3 setup.

### No coverage data displayed

Ensure you have at least one of these files in your coverage folder:
- `lcov.info`
- `coverage-final.json`

## Integration with Test Frameworks

### Jest

Add to `jest.config.js`:

```javascript
module.exports = {
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['lcov', 'json', 'html', 'text'],
};
```

Then run:
```bash
TESTOMATIO=<api_key> TESTOMATIO_COVERAGE=1 npm test
```

### Vitest

Add to `vitest.config.ts`:

```typescript
export default defineConfig({
  test: {
    coverage: {
      enabled: true,
      provider: 'v8', // or 'istanbul'
      reporter: ['lcov', 'json', 'html', 'text'],
    },
  },
});
```

Then run:
```bash
TESTOMATIO=<api_key> TESTOMATIO_COVERAGE=1 npm test
```

### NYC (for Mocha, CodeceptJS, etc.)

Create `.nycrc.json`:

```json
{
  "reporter": ["lcov", "json", "html", "text"],
  "report-dir": "coverage",
  "all": true
}
```

Then run:
```bash
TESTOMATIO=<api_key> TESTOMATIO_COVERAGE=1 npx nyc npm test
```

## Notes

- Coverage collection happens after all tests complete
- Large HTML reports may take time to upload
- Coverage data is associated with the test run ID
- You can view coverage reports by following the S3 link in the console output

## See Also

- [Artifacts Documentation](./artifacts.md) - S3 configuration details
- [Test Frameworks](./frameworks.md) - Framework-specific configuration
- [Pipes](./pipes.md) - Understanding reporter pipes
