# Testomatio reporter output control

Control the verbosity of `[TESTOMATIO]` prefixed messages using the `TESTOMATIO_LOG_LEVEL` environment variable.

## Levels

| Level   | Logs Shown                           |
| ------- | ------------------------------------ |
| `ERROR` | Only errors                          |
| `WARN`  | Warnings and errors                  |
| `INFO`  | Info, warnings, and errors (default) |

## Usage

```bash
# Show only errors
TESTOMATIO_LOG_LEVEL=ERROR npm test

# Show warnings and errors
TESTOMATIO_LOG_LEVEL=WARN npm test

# Default (show all info, warnings, errors)
TESTOMATIO_LOG_LEVEL=INFO npm test
# or just
npm test
```

## CI Example

```yaml
# GitHub Actions
- name: Run tests
  run: npm test
  env:
    TESTOMATIO: ${{ secrets.TESTOMATIO }}
    TESTOMATIO_LOG_LEVEL: WARN
```

## Debug Mode

For detailed debugging, use the `DEBUG` environment variable (uses the [debug](https://www.npmjs.com/package/debug) package):

```bash
DEBUG=@testomatio/reporter:* npm test
DEBUG=@testomatio/reporter:pipe:testomatio npm test
```

## See Also

- [Configuration](./configuration.md) - All environment variables
- [Debug File](./debug-file-format.md) - Understanding debug output files
