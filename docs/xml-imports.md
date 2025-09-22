# XML Imports Configuration

This document provides complete reference for XML import commands and configuration options in Testomatio Reporter.

## Basic Commands

### Standard XML Import

```bash
npx report-xml results.xml
```

### With API Key

```bash
TESTOMATIO={YOUR_API_KEY} npx report-xml results.xml
```

### Multiple Files

```bash
TESTOMATIO={YOUR_API_KEY} npx report-xml test-results/*.xml
```

## Performance Commands

### Fast Import (Disable Source Code)

```bash
TESTOMATIO_DISABLE_SOURCE_CODE=1 npx report-xml results.xml
```

### Prevent Duplicates (Recommended)

```bash
TESTOMATIO_SUITE_ORGANIZATION=classname npx report-xml results.xml
```

### Combined Fast & Clean Import

```bash
TESTOMATIO_DISABLE_SOURCE_CODE=1 TESTOMATIO_SUITE_ORGANIZATION=classname npx report-xml results.xml
```

## Full Configuration Examples

### Production Setup

```bash
TESTOMATIO={YOUR_API_KEY} \
TESTOMATIO_TITLE="Production Tests" \
TESTOMATIO_ENV="prod" \
TESTOMATIO_SUITE_ORGANIZATION=classname \
npx report-xml results.xml
```

### CI/CD Pipeline (Optimized)

```bash
TESTOMATIO_DISABLE_SOURCE_CODE=1 \
TESTOMATIO_SUITE_ORGANIZATION=classname \
TESTOMATIO={YOUR_API_KEY} \
TESTOMATIO_TITLE="CI Build #${BUILD_NUMBER}" \
npx report-xml test-results/*.xml
```

### Debug/Development Mode

```bash
TESTOMATIO_DISABLE_SOURCE_CODE=1 \
TESTOMATIO_SUITE_ORGANIZATION=classname \
npx report-xml results.xml
```

## Environment Variables

| Variable                         | Values                              | Purpose                                      |
| -------------------------------- | ----------------------------------- | -------------------------------------------- |
| `TESTOMATIO_DISABLE_SOURCE_CODE` | `1` or unset                        | Skip source code fetching for faster imports |
| `TESTOMATIO_SUITE_ORGANIZATION`  | `classname` (default) or `fullpath` | Control suite structure organization         |
| `TESTOMATIO`                     | API key                             | Your project API key                         |
| `TESTOMATIO_TITLE`               | String                              | Custom run title                             |
| `TESTOMATIO_ENV`                 | String                              | Environment label (e.g., "staging", "prod")  |
| `TESTOMATIO_URL`                 | URL                                 | Custom Testomatio server URL                 |
| `TESTOMATIO_RUN`                 | Run ID                              | Attach to existing run                       |

## Suite Organization Strategies

### Classname Strategy (Default - Recommended)

```bash
TESTOMATIO_SUITE_ORGANIZATION=classname
```

**Benefits:**

- Prevents duplicate folders and suites
- Clean, flat structure
- Faster navigation in UI
- Recommended for most projects

**Example structure:**

```
✓ ActionLogTests
✓ BillPreviewTests
✓ PaymentTests
```

### Fullpath Strategy

```bash
TESTOMATIO_SUITE_ORGANIZATION=fullpath
```

**Benefits:**

- Detailed project hierarchy
- Preserves full namespace structure
- Useful for complex multi-module projects

**Example structure:**

```
📁 Tests
  📁 NUnit_Tests
    📁 Billing
      ✓ ActionLogTests
      ✓ BillPreviewTests
```

## Framework-Specific Examples

### NUnit (.NET)

```bash
# Recommended for NUnit
TESTOMATIO_SUITE_ORGANIZATION=classname \
TESTOMATIO={API_KEY} \
npx report-xml TestResults.xml
```

### JUnit (Java/Maven)

```bash
# Standard Maven setup
TESTOMATIO={API_KEY} \
npx report-xml target/surefire-reports/*.xml
```

### JUnit (Java/Gradle)

```bash
# Standard Gradle setup
TESTOMATIO={API_KEY} \
npx report-xml build/test-results/test/*.xml
```

### xUnit (.NET)

```bash
# Fast import for xUnit
TESTOMATIO_DISABLE_SOURCE_CODE=1 \
TESTOMATIO={API_KEY} \
npx report-xml TestResults.xml
```

### MSTest (.NET)

```bash
# MSTest with Visual Studio
TESTOMATIO_SUITE_ORGANIZATION=classname \
TESTOMATIO={API_KEY} \
npx report-xml TestResults/*.trx
```

## Programmatic Configuration

### JavaScript/Node.js

```javascript
const XmlReader = require('@testomatio/reporter/lib/xmlReader');

// Basic usage
const reader = new XmlReader({
  apiKey: 'your-api-key',
  disableSourceCodeFetching: true,
  suiteOrganization: 'classname',
});

// Advanced NUnit configuration
const nunitReader = new XmlReader({
  apiKey: 'your-api-key',
  lang: 'csharp',
  enableNUnitDeduplication: true,
  suiteOrganization: 'classname',
});
```

## Common Issues & Solutions

### Problem: Duplicate folders and suites appearing

**Cause:** Using fullpath organization creates both folder and suite structures
**Solution:**

```bash
TESTOMATIO_SUITE_ORGANIZATION=classname npx report-xml results.xml
```

### Problem: Import taking too long

**Cause:** Source code fetching for large test suites
**Solution:**

```bash
TESTOMATIO_DISABLE_SOURCE_CODE=1 npx report-xml results.xml
```

### Problem: Missing detailed test structure

**Cause:** Using classname organization flattens structure
**Solution:**

```bash
TESTOMATIO_SUITE_ORGANIZATION=fullpath npx report-xml results.xml
```

### Problem: Tests not matching existing ones

**Cause:** Source code fetching disabled or file paths changed
**Solution:**

```bash
# Enable source code fetching
npx report-xml results.xml

# Or use create mode
TESTOMATIO_CREATE=1 npx report-xml results.xml
```

## Advanced Configuration

### NUnit Deduplication (Programmatic)

```javascript
const reader = new XmlReader({
  enableNUnitDeduplication: true,
  lang: 'csharp',
});
```

This feature handles:

- Parameterized test merging
- Examples consolidation
- FQN-based deduplication

### Custom Working Directory

```bash
TESTOMATIO_WORKDIR=/path/to/project \
TESTOMATIO_CREATE=1 \
npx report-xml results.xml
```

### Batch Processing

```bash
# Process multiple test result files
for file in test-results/*.xml; do
  TESTOMATIO_DISABLE_SOURCE_CODE=1 \
  TESTOMATIO_SUITE_ORGANIZATION=classname \
  TESTOMATIO={API_KEY} \
  npx report-xml "$file"
done
```

## Output Messages

You'll see these informational messages during import:

**Normal operation:**

```text
✓ Testomatio Reporter v2.3.5
📋 Using classname suite organization (avoids duplicates)
```

**With source code disabled:**

```text
✓ Testomatio Reporter v2.3.5
🚫 Source code fetching is disabled
📋 Using classname suite organization (avoids duplicates)
```

**With fullpath organization:**

```text
✓ Testomatio Reporter v2.3.5
📁 Using fullpath suite organization (may create nested structure)
```

## Best Practices

### For CI/CD Pipelines

```bash
# Fast, clean imports
TESTOMATIO_DISABLE_SOURCE_CODE=1 \
TESTOMATIO_SUITE_ORGANIZATION=classname \
TESTOMATIO={API_KEY} \
npx report-xml results.xml
```

### For Local Development

```bash
# Full features for better test matching
TESTOMATIO_SUITE_ORGANIZATION=classname \
TESTOMATIO={API_KEY} \
npx report-xml results.xml
```

### For Large Test Suites

```bash
# Optimize for performance
TESTOMATIO_DISABLE_SOURCE_CODE=1 \
TESTOMATIO_SUITE_ORGANIZATION=classname \
npx report-xml results.xml
```

### For Multi-Module Projects

```bash
# Preserve project structure
TESTOMATIO_SUITE_ORGANIZATION=fullpath \
TESTOMATIO={API_KEY} \
npx report-xml results.xml
```

## Migration from Previous Versions

If experiencing issues after upgrading:

1. **Quick fix for duplicates:**

   ```bash
   TESTOMATIO_SUITE_ORGANIZATION=classname
   ```

2. **Performance optimization:**

   ```bash
   TESTOMATIO_DISABLE_SOURCE_CODE=1
   ```

3. **Keep legacy behavior:**
   ```bash
   TESTOMATIO_SUITE_ORGANIZATION=fullpath
   ```

## Troubleshooting

### Debug Import Issues

```bash
# Enable debug output
DEBUG=@testomatio/reporter:xml npx report-xml results.xml
```

### Validate XML Structure

```bash
# Check if XML is valid
xmllint --noout results.xml
```

### Test Connection

```bash
# Test API connection
TESTOMATIO={API_KEY} npx @testomatio/reporter --version
```

## See Also

- [Configuration Options](configuration.md)
- [JUnit Documentation](junit.md)
- [CLI Usage](cli.md)
- [Artifacts Upload](artifacts.md)
