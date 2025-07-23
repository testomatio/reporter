# Debug File Format Specification

The Testomatio Reporter debug file format is used to capture and replay test execution data. This specification defines the structure, storage location, and content of debug files.

## File Format

Debug files use **JSONL (JSON Lines)** format, not standard JSON. Each line contains a single JSON object representing a specific action or data entry. This format allows for streaming processing and incremental writing.

```
{"t":"+0ms","datetime":"2024-01-15T10:30:00.000Z","timestamp":1705315800000}
{"t":"+5ms","data":"variables","testomatioEnvVars":{"TESTOMATIO":"abc123"}}
{"t":"+10ms","action":"createRun","params":{"title":"Test Run"}}
```

## File Storage

### File Location
Debug files are stored in the system's temporary directory:

**Primary File (timestamped):**
```
{os.tmpdir()}/testomatio.debug.{timestamp}.json
```
Example: `/tmp/testomatio.debug.1705315800000.json`

**Symlink (latest):**
```
{os.tmpdir()}/testomatio.debug.latest.json
```

The symlink always points to the most recently created debug file, providing a consistent access point for tools like the replay command.

### File Creation
- Files are created when `TESTOMATIO_DEBUG` or `DEBUG` environment variables are set
- A new timestamped file is created for each test session
- The symlink is updated to point to the latest file
- If symlink creation fails, it's logged but doesn't prevent file creation

## Entry Structure

Every entry in the debug file follows this base structure:

```json
{
  "t": "+{time}ms",     // Time elapsed since last action (required)
  // ... action-specific fields
}
```

### Time Field (`t`)
- Format: `"+{milliseconds}ms"` (e.g., `"+150ms"`, `"+2.5s"`)
- Represents time passed since the previous action
- Generated using `prettyMs()` for human readability

## Entry Types

### 1. Session Initialization

**Timestamp Entry:**
```json
{
  "t": "+0ms",
  "datetime": "2024-01-15T10:30:00.000Z",
  "timestamp": 1705315800000
}
```

**Environment Variables:**
```json
{
  "t": "+5ms",
  "data": "variables",
  "testomatioEnvVars": {
    "TESTOMATIO": "api_key_here",
    "TESTOMATIO_TITLE": "Test Run Title",
    "TESTOMATIO_ENV": "staging"
  }
}
```

**Store Data:**
```json
{
  "t": "+10ms",
  "data": "store",
  "store": {}
}
```

### 2. Test Run Management Actions

**Prepare Run:**
```json
{
  "t": "+15ms",
  "action": "prepareRun",
  "data": {
    "pipe": "testomatio",
    "pipeOptions": "tag-name=smoke"
  }
}
```

**Create Run:**
```json
{
  "t": "+20ms",
  "action": "createRun",
  "params": {
    "title": "Test Run Title",
    "env": "staging",
    "parallel": true,
    "isBatchEnabled": true
  }
}
```

**Finish Run:**
```json
{
  "t": "+5000ms",
  "actions": "finishRun",
  "params": {
    "status": "finished",
    "parallel": true
  }
}
```

### 3. Test Execution Actions

**Add Single Test:**
```json
{
  "t": "+100ms",
  "action": "addTest",
  "runId": "run-id-uuid",
  "testId": {
    "id": "test-unique-id",
    "title": "Test case title",
    "status": "passed",
    "time": 1500,
    "rid": "request-id",
    "suite": "Suite Name",
    "file": "path/to/test.js",
    "error": "Error message if failed",
    "steps": [
      {
        "title": "Step description",
        "status": "passed",
        "time": 500
      }
    ],
    "artifacts": [
      {
        "name": "screenshot.png",
        "type": "image/png",
        "path": "/path/to/screenshot.png"
      }
    ],
    "files": [
      "/path/to/attachment1.txt",
      "/path/to/attachment2.log"
    ]
  }
}
```

**Add Tests Batch:**
```json
{
  "t": "+200ms",
  "action": "addTestsBatch",
  "runId": "run-id-uuid",
  "tests": [
    {
      "id": "test-1",
      "title": "First test",
      "status": "passed",
      "time": 800
    },
    {
      "id": "test-2", 
      "title": "Second test",
      "status": "failed",
      "time": 1200,
      "error": "Assertion failed"
    }
  ]
}
```

## Field Definitions

### Common Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `t` | string | Yes | Time elapsed since last action (e.g., "+150ms") |
| `action` | string | Conditional | Action type identifier (most actions) |
| `actions` | string | Conditional | Action type identifier (for finishRun only) |
| `data` | string | Conditional | Data type identifier for non-action entries |

### Action-Specific Fields

#### `createRun` / `finishRun`
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `params` | object | Yes | Parameters for run creation/completion |
| `params.title` | string | No | Test run title |
| `params.env` | string | No | Environment name |
| `params.parallel` | boolean | No | Whether run supports parallel execution |
| `params.status` | string | No | Run status (for finishRun) |
| `params.isBatchEnabled` | boolean | No | Whether batch upload is enabled |

#### `addTest` / `addTestsBatch`
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `runId` | string | No | UUID of the test run |
| `testId` | object | Yes* | Single test data (for addTest) |
| `tests` | array | Yes* | Array of test objects (for addTestsBatch) |

*Either `testId` or `tests` is required depending on action type.

### Test Object Fields
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique test identifier |
| `title` | string | Yes | Test case title |
| `status` | string | Yes | Test status: "passed", "failed", "skipped", "pending" |
| `time` | number | No | Execution time in milliseconds |
| `rid` | string | No | Request ID for deduplication |
| `suite` | string | No | Test suite name |
| `file` | string | No | Test file path |
| `error` | string | No | Error message for failed tests |
| `stack` | string | No | Stack trace for failed tests |
| `code` | string | No | Test source code |
| `steps` | array | No | Array of test step objects |
| `artifacts` | array | No | Array of artifact objects |
| `files` | array | No | Array of file paths |

### Step Object Fields
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Step description |
| `status` | string | Yes | Step status |
| `time` | number | No | Step execution time |
| `error` | string | No | Error message for failed steps |

### Artifact Object Fields
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Artifact file name |
| `type` | string | No | MIME type |
| `path` | string | No | File system path |
| `url` | string | No | Remote URL |
| `size` | number | No | File size in bytes |

### Environment Variables Entry
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `data` | string | Yes | Must be "variables" |
| `testomatioEnvVars` | object | Yes | All TESTOMATIO_* environment variables |

### Store Entry
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `data` | string | Yes | Must be "store" |
| `store` | object | Yes | Internal store data |

## Status Values

### Test Status
- `"passed"` - Test executed successfully
- `"failed"` - Test failed with assertion or runtime error
- `"skipped"` - Test was skipped intentionally
- `"pending"` - Test is pending implementation
- `"retried"` - Test was retried

### Run Status
- `"started"` - Run has been initiated
- `"finished"` - Run completed normally
- `"failed"` - Run failed due to system error
- `"interrupted"` - Run was interrupted

## File Processing Rules

### Line Processing
1. Each line must be valid JSON
2. Empty lines and whitespace-only lines are ignored
3. Parse errors are logged but don't stop processing
4. Maximum of 3 parse errors are shown, then summarized

### Test Deduplication
- Tests with `rid` (request ID) are deduplicated
- Multiple entries with same `rid` are merged
- Later entries can override earlier fields
- Arrays (`files`, `artifacts`) are merged, not replaced
- Tests without `rid` are never deduplicated

### Data Merging
When merging duplicate tests:
1. Non-null/non-undefined values override null/undefined
2. Non-empty arrays override empty arrays
3. Files and artifacts arrays are concatenated
4. Other fields use "last value wins" strategy

## Usage Examples

### Enabling Debug Output
```bash
# Enable debug logging
export TESTOMATIO_DEBUG=1
# OR
export DEBUG=1

# Run tests
npm test
```

### Replay from Debug File
```bash
# Replay from latest debug file
npx testomatio-reporter replay

# Replay from specific file
npx testomatio-reporter replay /tmp/testomatio.debug.1705315800000.json
```

### Reading Debug Files
```javascript
import fs from 'fs';

// Read debug file line by line
const content = fs.readFileSync('/tmp/testomatio.debug.latest.json', 'utf-8');
const lines = content.trim().split('\n').filter(line => line.trim());

for (const line of lines) {
  try {
    const entry = JSON.parse(line);
    console.log(`[${entry.t}] ${entry.action || entry.data}`);
  } catch (err) {
    console.error('Parse error:', err.message);
  }
}
```

## Implementation Notes

### File Creation
- Debug files are created in the `DebugPipe` constructor when enabled
- Each test session gets a unique timestamped filename
- Symlink provides consistent access to the latest file

### Batch Processing
- Tests can be logged individually or in batches
- Batch interval is 5 seconds by default
- Batch upload is triggered on intervals and during finishRun

### Error Handling
- Parse errors don't stop file processing
- Missing required fields may cause replay failures
- Malformed entries are skipped with warnings

### Performance Considerations
- Files are written synchronously for data integrity
- Large test suites may produce substantial debug files
- Consider file cleanup policies for long-running systems

## Version Compatibility

This specification is compatible with:
- Testomatio Reporter v2.0.0+
- All major test frameworks (Jest, Mocha, Playwright, etc.)
- Node.js 14+ environments

## Security Notes

- Debug files may contain sensitive data from environment variables
- Store debug files securely and clean them regularly
- Consider filtering sensitive variables before logging
- Debug files are world-readable by default in temp directories