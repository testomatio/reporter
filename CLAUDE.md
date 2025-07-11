# Claude Development Rules

This document contains important guidelines for developing and maintaining the Testomatio Reporter project.

## Build Process

### When modifying adapter code in `src/` directory:

**ALWAYS run `npm run build` after making changes to TypeScript files in `src/`**

The project uses TypeScript compilation to generate CommonJS files in the `lib/` directory. All adapters and modules are compiled from `src/` to `lib/` during the build process.

```bash
# After modifying any files in src/, run:
npm run build
```

### Adapter Configuration

When configuring adapters in test frameworks:
- Use `require('../../lib/adapter/codecept')` for production builds
- Use `require('../../src/adapter/codecept')` only for development (may have ESM/CommonJS compatibility issues)
- Always ensure `npm run build` is run first if using lib directory

## Testing and Debugging

### Debug Mode

The reporter includes a debug pipe that can be enabled for troubleshooting:

```bash
# Enable debug mode to see detailed reporter output
TESTOMATIO_DEBUG=1 npx codeceptjs run

# Debug output is saved to /tmp/testomatio.debug.{timestamp}.json
```

The debug file contains:
- Test execution timeline
- Formatted step structures sent to reporter
- Error information
- Reporter configuration details

### Testing Commands

For CodeceptJS testing:
```bash
# Run specific test with debug
TESTOMATIO_DEBUG=1 npx codeceptjs run test_file.js --grep "@tag"

# Run lint and typecheck (if available)
npm run lint
npm run typecheck
```

## CodeceptJS Adapter Development

### Step Structure Format

The CodeceptJS adapter formats steps to match Playwright adapter structure:

```javascript
{
  category: 'user' | 'framework' | 'hook',
  title: 'I expectEqual 1, 1',
  duration: 0
}
```

### Key Properties in CodeceptJS Steps:
- `step.name` - Helper method name (e.g., 'expectEqual')
- `step.actor` - Actor name (e.g., 'I')
- `step.helperMethod` - Full helper method name
- `step.args` - Array of step arguments
- `step.status` - Step status ('success', 'failed')
- `step.startTime` / `step.endTime` - Timing information

### Test Requirements

When creating CodeceptJS tests:
- Use `@codeceptjs/expect-helper` for assertions
- Use `I.expectEqual()`, `I.expectTrue()`, etc. instead of browser functions
- Remove invalid test IDs like `@T001` from test titles
- Use `Data().Scenario()` format for data-driven tests
- End test files with `_test.js` suffix
- Use Section API for structured step reporting

## Common Development Tasks

### Lint and Type Check

Always run these commands before committing changes:
```bash
npm run lint      # If available
npm run typecheck # If available
```

### Testing Different Scenarios

Ensure comprehensive test coverage:
- Passing tests
- Failing tests  
- Skipped tests
- Hook failures (BeforeSuite, AfterSuite, Before, After)
- Section API usage
- Data-driven tests

## Important Notes

- Never commit without running `npm run build` first if modifying `src/` files
- Always test with debug mode to verify step structure formatting
- Ensure adapter compatibility with CodeceptJS 3.7+
- Follow existing patterns from Playwright adapter for consistency
- Use proper error handling for failed steps and hooks

## Environment Variables

- `TESTOMATIO_DEBUG=1` - Enable debug logging and file output
- `TESTOMATIO_DISABLE_BATCH_UPLOAD=1` - Disable batch upload for debugging
- `TESTOMATIO` - API token for reporter (optional for local testing)