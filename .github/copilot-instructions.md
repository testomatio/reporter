# GitHub Copilot Instructions for Testomatio Reporter

This document provides guidelines for developing and maintaining the Testomatio Reporter project.

## Project Overview

Testomatio Reporter is a TypeScript/JavaScript library that integrates with popular test frameworks (Playwright, Cypress, Jest, CodeceptJS, etc.) to provide a common interface for test reporting. The project uses TypeScript compilation to generate CommonJS files.

## Build Process

### TypeScript Compilation

The project compiles TypeScript from `src/` to `lib/` directory:

```bash
npm run build
```

> You may also use `build:bun`, it could be faster.

### Key Build Details

- Source files: `src/` directory (TypeScript/ESM)
- Output files: `lib/` directory (CommonJS)
- Build command removes `./cjs` and compiles with TypeScript, then runs post-build scripts
- `lib/` artifacts are generated during CI/release. Do not commit `lib/`—only commit changes under `src/` and supporting build/test config. Local builds are for validation only.

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
```

### Debug Mode

Enable debug mode for troubleshooting:

```bash
TESTOMATIO_DEBUG=1 npx codeceptjs run
```

Debug output is saved to `/tmp/testomatio.debug.{timestamp}.json` (path will be provided in the output) and contains:

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

## Development Workflow

1. Make changes to source files in `src/` (do not edit `lib/` manually)
2. (Optional) Run `npm run build` locally to ensure TypeScript still compiles; CI will produce release artifacts
3. Run appropriate tests to verify changes
4. Run `npm run format` to ensure code quality
5. Test with debug mode if needed: `TESTOMATIO_DEBUG=1 <test-command>`
6. Commit only `src/` + config/script changes (exclude `lib/`); CI builds `lib/` for publishing

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

- Committing generated `lib/` files (they are produced in CI; keep them out of PRs)
- Relying on a stale local build without running tests (optional build is for validation, but tests are mandatory)
- Not testing with debug mode when troubleshooting step formatting
- Modifying tests without ensuring compatibility with framework versions

## Additional Resources

- Main documentation: `README.md`
- API definition: `testomat-api-definition.yml`
- Framework docs: `docs/frameworks.md`
- Development rules: `CLAUDE.md`
