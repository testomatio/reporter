# Code Coverage Feature - Implementation Summary

## Overview

This PR implements code coverage reporting for the Testomatio Reporter, allowing users to generate coverage files (HTML, lcov, JSON) that can be uploaded and displayed on Testomat.io UI.

## Problem Statement

From issue #625: "user should generate a file (probably, html) > we have to display these reports on testomat UI"

## Solution

Implemented a complete code coverage reporting pipeline:

1. **Detection**: Automatically finds coverage files in the coverage folder
2. **Parsing**: Extracts metrics from lcov and JSON formats
3. **Upload**: Sends coverage files to S3 bucket
4. **Display**: Provides coverage summary in console and prepares data for UI

## Architecture

### Coverage Pipe (`src/pipe/coverage.js`)

- New pipe that integrates into existing pipe architecture
- Detects coverage files: `lcov.info`, `coverage-final.json`, HTML reports
- Parses coverage data to extract metrics
- Stores coverage information for uploader

### Coverage Upload (`src/client.js`)

- New method: `uploadCoverageFiles()`
- Uploads coverage files to S3 after test run completes
- Organizes files by run ID: `{runId}/coverage/`
- Logs main coverage report URL

### Configuration

```bash
TESTOMATIO_COVERAGE=1              # Enable coverage collection
TESTOMATIO_COVERAGE_FOLDER=path    # Custom folder (default: coverage)
```

## Test Framework Support

Works with all major JavaScript test frameworks that can generate coverage:

- ✅ Jest (built-in coverage)
- ✅ Vitest (v8 or istanbul)
- ✅ Playwright (via coverage plugins)
- ✅ Mocha + NYC
- ✅ CodeceptJS + NYC
- ✅ Cypress + coverage plugin

## Coverage Formats Supported

1. **LCOV** (`lcov.info`)
   - Standard format used by most tools
   - Contains line, branch, and function coverage
   - Parsed to extract metrics

2. **JSON** (`coverage-final.json`)
   - Istanbul/NYC JSON format
   - Detailed per-file coverage data
   - Alternative to lcov

3. **HTML** (`lcov-report/`)
   - Visual coverage reports
   - Multiple HTML files
   - Uploaded for viewing in browser

## Metrics Collected

- **Lines**: Covered lines / Total lines (percentage)
- **Branches**: Covered branches / Total branches (percentage)
- **Functions**: Covered functions / Total functions (percentage)
- **Files**: Number of files with coverage data

## Console Output

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
[TESTOMATIO] Coverage report: https://s3.amazonaws.com/.../index.html
```

## Testing

### Unit Tests (21 new tests, all passing)

- Coverage pipe initialization
- LCOV file parsing
- JSON coverage file parsing
- Coverage file collection
- Edge cases (empty files, missing files, etc.)

### Integration

- Example project with Vitest
- Coverage configuration
- Sample source files and tests
- Demo script

## Documentation

### New Documentation (`docs/coverage.md`)

- Feature overview
- Configuration guide
- Framework-specific examples
- Troubleshooting
- Integration examples

### Updated Documentation

- README.md: Added coverage to feature list
- Added coverage to documentation index

## Security

✅ CodeQL scan: 0 vulnerabilities found
✅ No new dependencies in core package
✅ Uses existing secure S3 upload mechanism
✅ Proper environment variable handling

## Files Changed

### New Files (6)
- `src/pipe/coverage.js` - Coverage pipe implementation
- `docs/coverage.md` - Coverage documentation
- `tests/unit/coverage_pipe_test.js` - Unit tests
- `example/vitest/src/calculator.js` - Example source
- `example/vitest/tests/coverage.spec.js` - Example tests
- `test-coverage-demo.sh` - Demo script

### Modified Files (6)
- `src/constants.js` - Coverage constants
- `src/pipe/index.js` - Pipe factory integration
- `src/client.js` - Upload functionality
- `README.md` - Feature documentation
- `example/vitest/package.json` - Coverage dependencies
- `example/vitest/vitest.config.js` - Coverage config

## Usage Examples

### Jest

```bash
TESTOMATIO=<api_key> TESTOMATIO_COVERAGE=1 npm test -- --coverage
```

### Vitest

```bash
TESTOMATIO=<api_key> TESTOMATIO_COVERAGE=1 npm run test:coverage
```

### Mocha + NYC

```bash
TESTOMATIO=<api_key> TESTOMATIO_COVERAGE=1 npx nyc mocha
```

### With S3 Upload

```bash
TESTOMATIO=<api_key> \
TESTOMATIO_COVERAGE=1 \
S3_BUCKET=my-bucket \
S3_REGION=us-east-1 \
S3_ACCESS_KEY_ID=xxx \
S3_SECRET_ACCESS_KEY=yyy \
npm test -- --coverage
```

## Backend Integration

The coverage data is now ready for Testomat.io UI integration:

1. **File Location**: Files uploaded to `{runId}/coverage/` in S3
2. **File Types**: lcov.info, coverage-final.json, HTML reports
3. **Metadata**: Coverage summary stored in pipe store
4. **Access**: Use run ID to retrieve coverage files from S3

### Recommended UI Features

1. **Coverage Summary Card**
   - Show lines/branches/functions percentages
   - Compare with previous runs
   - Trend graphs

2. **HTML Report Viewer**
   - Embed S3-hosted HTML reports
   - Direct link to index.html

3. **File Coverage Details**
   - Parse lcov/JSON for per-file coverage
   - Show uncovered lines
   - Highlight changes in coverage

## Limitations

- Coverage generation must be done by test framework
- S3 bucket required for uploads (same as artifacts)
- HTML reports uploaded as-is (no processing)

## Future Enhancements

Potential future improvements (not in scope):

1. Coverage comparison between runs
2. Coverage thresholds/gates
3. Integration with GitHub/GitLab PR comments
4. Coverage badge generation
5. Support for more coverage formats (Cobertura XML)

## Testing Checklist

- ✅ All existing tests pass (282/282)
- ✅ New coverage tests pass (21/21)
- ✅ Linting passes
- ✅ Build successful
- ✅ Security scan clean
- ✅ Example project works
- ✅ Documentation complete

## Deployment

No special deployment steps required:

1. Merge PR
2. Publish npm package
3. Users can start using with `TESTOMATIO_COVERAGE=1`
4. Backend team can integrate coverage display

## Support

Users can get help:

1. Documentation: `docs/coverage.md`
2. Examples: `example/vitest/`
3. Troubleshooting section in docs
4. Environment variable reference

## Conclusion

The code coverage feature is fully implemented, tested, documented, and ready for use. It seamlessly integrates with the existing reporter architecture and provides a solid foundation for displaying coverage data on Testomat.io UI.
