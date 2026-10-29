## Debug Pipe

Debug Pipe stores data for debugging purposes in a temporary json file.

**🔌 To enable Debug pipe set `TESTOMATIO_DEBUG` environment variable with value `true` or `1` **

Add an env to run by specifying the `TESTOMATIO_DEBUG` variable.

```bash
TESTOMATIO_DEBUG=1 <actual run command>
```

## Replaying Debug Data

If your test run fails to upload results properly, you can replay the data from the debug file using the CLI.

The latest run is always accessible at:

```
./testomatio.debug.json
```

Run history can be found in `/tmp` dir with filename like `/tmp/testomatio.debug.<datetime>.json`.

You can replay the latest debug data simply with:

```bash
# Replay the test data to Testomat.io
TESTOMATIO=<your-api-key> npx @testomatio/reporter replay
```

You can also specify a custom debug file path if needed:

```bash
# Replay from a custom debug file
TESTOMATIO=<your-api-key> npx @testomatio/reporter replay /path/to/debug-file.json
```

The debug file location is printed to the console when the debug pipe finishes.

## Debug File Format

The debug file contains JSON lines with timing information and test data:

- **Environment variables**: Testomatio-related environment variables
- **Run parameters**: Parameters used to create the test run
- **Test batches**: All test results with full details including steps, errors, and metadata
- **Finish parameters**: Final run status and configuration

For more details, see the [CLI replay command documentation](../cli.md#replay).
