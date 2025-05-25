## Debug Pipe

Debug Pipe stores data for debugging purposes in a temporary json file.

**🔌 To enable Debug pipe set `TESTOMATIO_DEBUG` environment variable with value `true` or `1` **

Add an env to run by specifying the `TESTOMATIO_DEBUG` variable.

```bash
TESTOMATIO_DEBUG=1 <actual run command>
```

## Replaying Debug Data

If your test run fails to upload results properly, you can replay the data from the debug file using the CLI.

The debug pipe creates timestamped debug files (e.g., `testomatio.debug.1748206578783.json`) and maintains a symlink at `/tmp/testomatio.debug.latest.json` that always points to the most recent debug file. This allows you to keep a history of debug files while having a consistent path to the latest one.

You can replay the latest debug data simply with:

```bash
# Replay the test data to Testomat.io
TESTOMATIO=<your-api-key> npx @testomatio/reporter replay
```

You can also specify a custom debug file path if needed:

```bash
# Replay from a custom debug file
TESTOMATIO=<your-api-key> npx @testomatio/reporter replay /path/to/custom-debug.json
```

The debug file location is printed to the console when the debug pipe finishes:

```
[TESTOMATIO] 🪲 Debug Saved to /tmp/testomatio.debug.1748206578783.json
```

The symlink `/tmp/testomatio.debug.latest.json` will always point to the most recently created debug file.

## Debug File Format

The debug file contains JSON lines with timing information and test data:

- **Environment variables**: Testomatio-related environment variables
- **Run parameters**: Parameters used to create the test run
- **Test batches**: All test results with full details including steps, errors, and metadata
- **Finish parameters**: Final run status and configuration

For more details, see the [CLI replay command documentation](../cli.md#replay).
