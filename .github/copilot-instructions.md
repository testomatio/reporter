# GitHub Copilot Instructions for Testomatio Reporter

This document provides guidelines for developing and maintaining the Testomatio Reporter project.

## Project Overview

Testomatio Reporter is a TypeScript/JavaScript library that integrates with popular test frameworks (Playwright, Cypress, Jest, CodeceptJS, etc.) to provide a common interface for test reporting. The project uses TypeScript compilation to generate CommonJS files.

## Build Process

### TypeScript Compilation

**Always run `npm run build` after making changes to TypeScript files in the `src/` directory.**

The project compiles TypeScript from `src/` to `lib/` directory:

```bash
npm run build
```

### Key Build Details

- Source files: `src/` directory (TypeScript/ESM)
- Output files: `lib/` directory (CommonJS)
- Build command removes `./cjs` and compiles with TypeScript, then runs post-build scripts
- Never commit without running `npm run build` if modifying `src/` files

## Project Structure

```
src/           - TypeScript source files (ESM modules)
lib/           - Compiled CommonJS output
tests/         - Test files
tests/adapter/ - Framework adapter tests
packages/      - Additional packages
docs/          - Documentation
example/       - Example integrations
```

## Testing

### Available Test Commands

```bash
# Run unit tests
npm test

# Run framework-specific tests
npm run test:playwright
npm run test:codecept
npm run test:vitest
npm run test:frameworks  # All framework tests
npm run test:all         # All tests including unit

# Run specific adapter tests
npm run test:adapters
```

### Debug Mode

Enable debug mode for troubleshooting:

```bash
TESTOMATIO_DEBUG=1 npx codeceptjs run
```

Debug output is saved to `/tmp/testomatio.debug.{timestamp}.json` and contains:
- Test execution timeline
- Formatted step structures
- Error information
- Reporter configuration

### Important Environment Variables

- `TESTOMATIO_DEBUG=1` - Enable debug logging
- `TESTOMATIO_DISABLE_BATCH_UPLOAD=1` - Disable batch upload for debugging
- `TESTOMATIO` - API token for reporter (optional for local testing)

## Code Quality

### Linting and Formatting

```bash
npm run lint           # Run ESLint
npm run lint:fix       # Fix ESLint issues
npm run pretty         # Check Prettier formatting
npm run pretty:fix     # Fix Prettier formatting
npm run format         # Run both lint:fix and pretty:fix
```

Always run linting and formatting before committing changes.

## Adapter Development

### CodeceptJS Adapter

When working with CodeceptJS adapter:

- Use `@codeceptjs/expect-helper` for assertions
- Format steps to match structure: `{ category: 'user'|'framework'|'hook', title: string, duration: number }`
- Key properties: `step.name`, `step.actor`, `step.helperMethod`, `step.args`, `step.status`
- Use Section API for structured step reporting
- Test files should end with `_test.js` suffix

### Adapter Configuration

- Production: `require('../../lib/adapter/codecept')`
- Development: `require('../../src/adapter/codecept')` (note: may have ESM/CommonJS issues)
- Always run `npm run build` before using `lib/` directory

## Testing Requirements

When creating or modifying tests, ensure coverage for:
- Passing tests
- Failing tests
- Skipped tests
- Hook failures (BeforeSuite, AfterSuite, Before, After)
- Section API usage (for supported frameworks)
- Data-driven tests

## Development Workflow

1. Make changes to source files in `src/`
2. Run `npm run build` to compile TypeScript
3. Run appropriate tests to verify changes
4. Run `npm run format` to ensure code quality
5. Test with debug mode if needed: `TESTOMATIO_DEBUG=1 <test-command>`
6. Commit changes after all checks pass

## Important Notes

- Node.js version: >=18 (specified in package.json engines)
- The project uses ESM (`"type": "module"` in package.json)
- Main entry: `lib/reporter.js` (CommonJS)
- Module entry: `src/reporter.js` (ESM)
- TypeScript types: `types/types.d.ts`
- Always ensure adapter compatibility with framework versions
- Use proper error handling for failed steps and hooks
- Follow existing patterns from Playwright adapter for consistency

## Common Pitfalls

- Forgetting to run `npm run build` after modifying `src/` files
- Using `src/` imports in production configurations (use `lib/` instead)
- Not testing with debug mode when troubleshooting step formatting
- Modifying tests without ensuring compatibility with framework versions

## Additional Resources

- Main documentation: `README.md`
- API definition: `testomat-api-definition.yml`
- Framework docs: `docs/frameworks.md`
- Development rules: `CLAUDE.md`
