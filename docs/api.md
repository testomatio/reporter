# Reporting API

This guide explains how to report test results directly to Testomat.io using API.

Also please refer to the [Reporting API reference](https://testomatio.github.io/reporter/)

## Prerequisites

- A Testomat.io account
- Project API key (can be found on Settins > Project page, starts with `tstmt_`)

## API Overview

Testomat.io's API allows you to:

1. Create a run
2. Send test results to a run
3. Match test results to existing tests
4. Finish a run

The base URL for all API requests is `https://app.testomat.io`.

## Authentication

All requests require your Testomat.io API key. You can include it as a query parameter or in the request body:

```
api_key=tstmt_your_api_key
```

## Step 1: Create a Run

First, create a new test run to report results to:

**CURL Example:**

```bash
curl -X POST "https://app.testomat.io/api/reporter?api_key=tstmt_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My Test Run",
    "env": "production",
  }'
```

**HTTP Request:**

```
POST https://app.testomat.io/api/reporter?api_key=tstmt_your_api_key
Content-Type: application/json

{
  "title": "My Test Run",
  "env": "production",
}
```

**Request Body Options:**

all params are **optional**:

- `title` (string): Name of your test run
- `env` (string): The environment tests ran in (e.g., "staging", "production")
- `group_title` (string): Put this run into Rungroup found by its title

**Response:**

```json
{
  "uid": "a0b1c2d3",
  "url": "https://app.testomat.io/projects/<project-id>/runs/a0b1c2d3"
}
```

Save the `uid` value - you'll need it to report test results.

## Step 2: Report Test Results

> By default, Testomat.io won't create tests automatically. Include `"create": true` in your request to create tests automatically. See details in the next section.

You can report test results individually or in batches:

### Individual Test Reporting

**CURL Example:**

```bash
curl -X POST "https://app.testomat.io/api/reporter/a0b1c2d3/testrun?api_key=tstmt_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Should login successfully",
    "status": "passed",
    "suite_title": "Authentication Tests",
    "test_id": "d8b9c0e1",
    "run_time": 0.5,
    "stack": "Error: .... (complete exception trace)"
  }'
```

**HTTP Request:**

```
POST https://app.testomat.io/api/reporter/a0b1c2d3/testrun?api_key=tstmt_your_api_key
Content-Type: application/json

{
  "title": "Should login successfully",
  "status": "passed",
  "suite_title": "Authentication Tests",
  "test_id": "@Ta0b0c0d0",
  "run_time": 0.5,
  "stack": "Error: .... (complete exception trace)"
}
```

### Batch Test Reporting

**CURL Example:**

```bash
curl -X POST "https://app.testomat.io/api/reporter/a0b1c2d3/testrun?api_key=tstmt_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "tstmt_your_api_key",
    "tests": [
      {
        "title": "Should login successfully",
        "status": "passed",
        "suite_title": "Authentication Tests",
        "test_id": "@Ta0b0c0d0",
        "rid": "windows-login-test",
        "run_time": 0.5
      },
      {
        "title": "Should login successfully",
        "status": "passed",
        "suite_title": "Authentication Tests",
        "test_id": "@Ta0b0c0d0",
        "rid": "linux-login-test",
        "run_time": 0.6
      },
      {
        "title": "Should show error for invalid credentials",
        "status": "failed",
        "suite_title": "Authentication Tests",
        "test_id": "T2",
        "rid": "windows-error-test",
        "run_time": 0.3,
        "message": "Expected error message not shown",
        "stack": "Error: Expected error message not shown...)"
      }
    ],
  }'
```

**HTTP Request:**

```
POST https://app.testomat.io/api/reporter/a0b1c2d3/testrun?api_key=tstmt_your_api_key
Content-Type: application/json

{
  "api_key": "tstmt_your_api_key",
  "tests": [
    {
      "title": "Should login successfully",
      "status": "passed",
      "suite_title": "Authentication Tests",
      "test_id": "@Ta0b0c0d0",
      "rid": "windows-login-test",
      "run_time": 0.5
    },
    {
      "title": "Should login successfully",
      "status": "passed",
      "suite_title": "Authentication Tests",
      "test_id": "@Ta0b0c0d0",
      "rid": "linux-login-test",
      "run_time": 0.6
    },
    {
      "title": "Should show error for invalid credentials",
      "status": "failed",
      "suite_title": "Authentication Tests",
      "test_id": "T2",
      "rid": "windows-error-test",
      "run_time": 0.3,
      "message": "Expected error message not shown",
      "stack": "Error: Expected error message not shown...)"
    }
  ],
  "batch_index": 1
}
```

**Key Test Properties:**

- `title` (string): Test name
- `status` (string): Must be "passed", "failed", or "skipped"
- `test_id` (string): ID of the test in Testomat.io (optional)
- `suite_title` (string): Test suite name (optional)
- `run_time` (number): Test duration in seconds
- `message` (string): Error message for failed tests
- `stack` (string): Stack trace for failed tests
- `steps` (array): Test steps (optional)
- `artifacts` (array): URLs to test artifacts like screenshots (optional)
- `rid` (string): Report ID to uniquely identify test executions (optional)

> `rid` parameter is used to identify the same test which are executed in multiple environments. So let's say we run one test on Windows and Linux, but we want to have it reported twice, so we can use different rids but same test_id for it

### Using Report ID (rid) for Cross-Platform Testing

The `rid` parameter allows you to report the same test multiple times in a single run. This is especially useful for **Cross-platform testing**.
When you run the same test on different environments, like operating systems or browsers

**Example Scenario:**

In this example, we run the same login test (with ID "@Ta0b0c0d0") on both Windows and Linux:

```
POST https://app.testomat.io/api/reporter/a0b1c2d3/testrun?api_key=tstmt_your_api_key
Content-Type: application/json

{
  "tests": [
    {
      "title": "Should login successfully",
      "status": "passed",
      "test_id": "@Ta0b0c0d0",
      "rid": "chrome-login:windows",
      "run_time": 0.5,
      "suite_title": "Login Tests"
    },
    {
      "title": "Should login successfully",
      "status": "failed",
      "test_id": "@Ta0b0c0d0",
      "rid": "chrome-login:linux",
      "run_time": 0.6,
      "suite_title": "Login Tests",
      "message": "Login failed on Linux",
      "stack": "Error: Login failed on Linux\n    at Object.login (/tests/linux/auth.test.js:25:7)"
    }
  ],
  "batch_index": 1
}
```

By using different `rid` values, both test executions will be reported separately in Testomat.io, even though they have the same `test_id`. The platform will recognize them as different executions of the same test.

## Step 3: Finish the Test Run

When all tests are reported, finish the test run:

**CURL Example:**

```bash
curl -X PUT "https://app.testomat.io/api/reporter/a0b1c2d3?api_key=tstmt_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "status_event": "finish",
    "duration": 25.5
  }'
```

**HTTP Request:**

```
PUT https://app.testomat.io/api/reporter/a0b1c2d3?api_key=tstmt_your_api_key
Content-Type: application/json

{
  "status_event": "finish",
  "duration": 25.5
}
```

**Finishing Options:**

- `status_event`: Use "finish" to calculate status from test results, or explicitly set "pass" or "fail"
- `duration`: Total run duration in seconds

## Creating Tests Automatically

If you want to automatically create tests in Testomat.io that don't exist yet, include `"create": true` in your request:

**CURL Example:**

```bash
curl -X POST "https://app.testomat.io/api/reporter/a0b1c2d3/testrun?api_key=tstmt_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "New Test Case",
    "status": "passed",
    "create": true
  }'
```

**HTTP Request:**

```
POST https://app.testomat.io/api/reporter/a0b1c2d3/testrun?api_key=tstmt_your_api_key
Content-Type: application/json

{
  "title": "New Test Case",
  "status": "passed",
  "create": true
}
```

This API enables seamless integration of your testing tools with Testomat.io, allowing you to report test results from any CI/CD pipeline or custom testing solution.

## Reporting Test Steps to Testomat.io

When reporting tests to Testomat.io, you can include detailed steps for better test analysis and debugging. Steps provide a hierarchical representation of test execution that makes it easier to understand what happened during the test.

### Step Structure

Steps in Testomat.io follow a hierarchical structure and can include:

```
POST https://app.testomat.io/api/reporter/a0b1c2d3/testrun?api_key=tstmt_your_api_key
Content-Type: application/json

{
  "title": "Login Test",
  "status": "passed",
  "test_id": "T1",
  "steps": [
    {
      "category": "user",
      "title": "Navigate to login page",
      "duration": 232
    },
    {
      "category": "user",
      "title": "Enter credentials",
      "duration": 421,
      "steps": [
        {
          "category": "framework",
          "title": "Fill username input",
          "duration": 150
        },
        {
          "category": "framework",
          "title": "Fill password input",
          "duration": 145
        },
        {
          "category": "framework",
          "title": "Click submit button",
          "duration": 126
        }
      ]
    },
    {
      "category": "user",
      "title": "Verify user is logged in",
      "duration": 510
    }
  ]
}
```

### Step Properties

Each step can include the following properties:

- `category` (string): Classifies the step type. Common values include:

  - `user`: High-level user action steps
  - `framework`: Internal framework operations
  - `hook`: Test hooks like beforeEach, afterEach

- `title` (string): Description of the step

- `duration` (number): Time taken to execute the step in milliseconds

- `steps` (array): Nested steps (sub-steps)

- `error` (object): Error information if the step failed

### Example: Complex Test with Steps and Error

```
POST https://app.testomat.io/api/reporter/a0b1c2d3/testrun?api_key=tstmt_your_api_key
Content-Type: application/json

{
  "title": "User checkout process",
  "status": "failed",
  "test_id": "T45",
  "steps": [
    {
      "category": "user",
      "title": "Login as test user",
      "duration": 845,
      "steps": [
        {
          "category": "framework",
          "title": "Navigate to login page",
          "duration": 312
        },
        {
          "category": "framework",
          "title": "Fill credentials",
          "duration": 421
        },
        {
          "category": "framework",
          "title": "Submit form",
          "duration": 112
        }
      ]
    },
    {
      "category": "user",
      "title": "Add product to cart",
      "duration": 653,
      "steps": [
        {
          "category": "framework",
          "title": "Navigate to product page",
          "duration": 245
        },
        {
          "category": "framework",
          "title": "Click add to cart button",
          "duration": 408
        }
      ]
    },
    {
      "category": "user",
      "title": "Complete checkout",
      "duration": 1205,
      "steps": [
        {
          "category": "framework",
          "title": "Navigate to checkout",
          "duration": 320
        },
        {
          "category": "framework",
          "title": "Fill shipping information",
          "duration": 545
        },
        {
          "category": "framework",
          "title": "Submit payment",
          "duration": 340,
          "error": {
            "message": "Payment gateway timeout",
            "stack": "Error: Payment gateway timeout\n ..."
          }
        }
      ]
    }
  ],
  "message": "Test failed during payment submission",
  "stack": "Error: Payment gateway timeout\n ..."
}
```

By providing detailed step information, you can quickly identify which part of the test failed and under what circumstances, making debugging and test maintenance much easier.

## Uploading Artifacts to Testomat.io

Test artifacts such as screenshots, videos, logs, and other files provide crucial evidence of test execution. Testomat.io allows you to upload and associate these artifacts with your test runs.

### Artifact Upload Methods

There are two ways to upload artifacts to Testomat.io:

1. **Direct URL Reference**: Link to files already uploaded to publicly accessible locations
2. **S3 Storage**: Upload files to Amazon S3 storage configured with Testomat.io

### Reporting Tests with Artifacts

To associate artifacts with a test, include the `artifacts` property in your test data:

```
POST https://app.testomat.io/api/reporter/a0b1c2d3/testrun?api_key=tstmt_your_api_key
Content-Type: application/json

{
  "title": "Login Test",
  "status": "failed",
  "test_id": "@Ta0b0c0d0",
  "artifacts": [
    "https://your-s3-bucket.s3.amazonaws.com/screenshots/login-failure.png",
    "https://your-s3-bucket.s3.amazonaws.com/videos/login-test.mp4"
  ],
  "message": "Failed to log in with valid credentials"
}
```

To make Testomat.io display artifacts, configure its access in Settings > Artifacts section, setting all S3 bucket credentials.

Instead of AWS S3 you can use any other S3 provider like:

- Google Cloud Storage
- Digital Ocean Spaces
- MinIO
- Cloudflare R2
- etc

## Reporting Parameterized Tests

Parameterized tests (also known as data-driven tests) run the same test logic with different input data. Testomat.io provides a way to report these tests clearly, showing both the test structure and the specific data used for each test run.

### Using the `example` Parameter

When reporting parameterized tests, use the `example` parameter to identify the specific data set used in each test execution:

```
POST https://app.testomat.io/api/reporter/run-id-12345/testrun?api_key=tstmt_your_api_key
Content-Type: application/json

{
  "title": "User login with different roles",
  "status": "passed",
  "test_id": "T1",
  "rid": "login-admin-role",
  "example": {
    "username": "admin",
    "role": "administrator",
    "expectedPermissions": ["read", "write", "delete"]
  }
}
```

In this example, the `example` parameter contains the specific data used for this test run.

### Reporting Multiple Parameterized Test Runs

For tests that run with multiple data sets, report each execution with the same test ID but different RIDs and examples:

```
POST https://app.testomat.io/api/reporter/run-id-12345/testrun?api_key=tstmt_your_api_key
Content-Type: application/json

{
  "tests": [
    {
      "title": "User login with different roles",
      "status": "passed",
      "test_id": "T1",
      "rid": "login-admin-role",
      "example": {
        "username": "admin",
        "role": "administrator",
        "expectedPermissions": ["read", "write", "delete"]
      }
    },
    {
      "title": "User login with different roles",
      "status": "passed",
      "test_id": "T1",
      "rid": "login-editor-role",
      "example": {
        "username": "editor",
        "role": "content_editor",
        "expectedPermissions": ["read", "write"]
      }
    },
    {
      "title": "User login with different roles",
      "status": "failed",
      "test_id": "T1",
      "rid": "login-viewer-role",
      "example": {
        "username": "viewer",
        "role": "readonly",
        "expectedPermissions": ["read"]
      },
      "message": "User was granted write permission when they should only have read"
    }
  ],
}
```

### Example Structure

The `example` parameter can contain any JSON structure that represents your test data:

- **Simple parameters**: `{"username": "admin", "password": "secret"}`
- **Complex objects**: `{"user": {"id": 1, "role": "admin"}, "settings": {"theme": "dark"}}`

A string can also be passed as example, in this case it will be reported as:

```json
{ "example": "your string" }
```

### Complete Example: Table-Driven Test

Here's a complete example of reporting a table-driven test that verifies email validation with different inputs:

```
POST https://app.testomat.io/api/reporter/run-id-12345/testrun?api_key=tstmt_your_api_key
Content-Type: application/json

{
  "tests": [
    {
      "title": "Email validation",
      "status": "passed",
      "test_id": "@T01010101",
      "example": {
        "email": "user@example.com",
        "expectedValid": true
      }
    },
    {
      "title": "Email validation",
      "status": "passed",
      "test_id": "@T01010101",
      "example": {
        "email": "user@subdomain.example.com",
        "expectedValid": true
      }
    },
    {
      "title": "Email validation",
      "status": "passed",
      "test_id": "@T01010101",
      "example": {
        "email": "userexample.com",
        "expectedValid": false
      }
    },
    {
      "title": "Email validation",
      "status": "failed",
      "test_id": "@T01010101",
      "example": {
        "email": "user+code@example.com",
        "expectedValid": true
      },
      "message": "Valid email with + character was rejected",
      "stack": "Error: Expected validation to pass but got false\n    at validateEmail (/tests/validation.js:45:7)"
    }
  ],
  "batch_index": 1
}
```

By properly structuring your parameterized test reports with examples, you'll be able to quickly identify which specific data sets are causing test failures and understand the context of each test execution.
