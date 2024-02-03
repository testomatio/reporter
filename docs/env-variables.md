# Environment variables

You can pass environment variables to the testomat.io reporter using the following syntax:

`bash TESTOMATIO={API_KEY} <actual run command>`

When running on CI, use secrets.

To read environment variables from `.env` file, use [dotenv](https://www.npmjs.com/package/dotenv) package. And read the env file via:

```javascript
require('dotenv').config({ path: '.env' }); // or any other path
```

## Variables list:

| Name                                                       | Description                                                                     | Example                                                                                                                |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `TESTOMATIO` or `TESTOMATIO_TOKEN` or `TESTOMATIO_API_KEY` | Your api key.                                                                   |
| `TESTOMATIO_CSV_FILENAME`                                  |                                                                                 |
| `TESTOMATIO_CREATE`                                        | Create test ids.                                                                |
| `TESTOMATIO_ENV`                                           | Adding Environments to Run                                                      | `TESTOMATIO={API_KEY} TESTOMATIO_ENV="Windows, Chrome" <actual run command>`                                           |
| `TESTOMATIO_EXCLUDE_FILES_FROM_REPORT_GLOB_PATTERN`        | Exclude tests from report by [glob pattern](https://www.npmjs.com/package/glob) | `TESTOMATIO_EXCLUDE_FILES_FROM_REPORT_GLOB_PATTERN="**/*.setup.ts" <actual run command>`. You may use multiple patterns, separate them with semicolon (`;`): `TESTOMATIO_EXCLUDE_FILES_FROM_REPORT_GLOB_PATTERN="**/*.setup.ts;tests/*.auth.js" <actual run command>`           |
| `TESTOMATIO_INTERCEPT_CONSOLE_LOGS`                        | Intercept console logs and add them to your report.                             | `TESTOMATIO_INTERCEPT_CONSOLE_LOGS=true <actual run command>`                                                          |
| `TESTOMATIO_PROCEED`                                       | Do Not Finalize Run                                                             | `TESTOMATIO_PREPEND_DIR="MyTESTS" TESTOMATIO=1111111 npx check-tests CodeceptJS "**/*{.,_}{test,spec}.js"`             |
| `TESTOMATIO_PREPEND_DIR`                                   | Put all imported tests into a specific suite (folder)                           |
| `TESTOMATIO_RUN`                                           | Add Report to Run by ID                                                         |
| `TESTOMATIO_RUNGROUP_TITLE`                                | Adding Report to RunGroup                                                       | `TESTOMATIO={API_KEY} TESTOMATIO_RUNGROUP_TITLE="Build ${BUILD_ID}" <actual run command>`                              |
| `TESTOMATIO_SHARED_RUN`                                    | Reporting Parallel Execution to To Same Run                                     | `TESTOMATIO={API_KEY} TESTOMATIO_TITLE="report for commit ${GIT_COMMIT}" TESTOMATIO_SHARED_RUN=1 <actual run command>` |
| `TESTOMATIO_STACK_FILTER`                                  |                                                                                 |
| `TESTOMATIO_TITLE`                                         | Setting Report Title                                                            | `TESTOMATIO={API_KEY} TESTOMATIO_TITLE="title for the report" <actual run command>`                                    |
| `TESTOMATIO_TITLE_IDS`                                     |                                                                                 |
| Artifacts                                                  |                                                                                 |
| `S3_ACCESS_KEY_ID`                                         |                                                                                 |
| `S3_BUCKET`                                                |                                                                                 |
| `S3_ENDPOINT`                                              |                                                                                 |
| `S3_REGION`                                                |                                                                                 |
| `S3_SECRET_ACCESS_KEY`                                     |                                                                                 |
| Pipes                                                      |                                                                                 |
| `GH_PAT`                                                   |                                                                                 |
| `GITLAB_PAT`                                               |                                                                                 |

# .env file usage

You can use `.env` file to store your environment variables. To read environment variables from `.env` file, use [dotenv](https://www.npmjs.com/package/dotenv) package:

```javascript
require('dotenv').config({ path: '.env' }); // or any other path
```

or

```javascript
import dotenv from 'dotenv';
dotenv.config({ path: '.env' }); // or any other path
```

It is recommended to read `.env` file as early as possible in your application, preferably on test runner initialization.
E.g. in CodeceptJS you can do it in `codecept.conf.js` file. In Playwright: `playwright.config.js`. Jest: `jest.config.js`. Cypress: `cypress.config.js`. And so on.

It is recommended to add `.env` file to `.gitignore` to avoid committing sensitive data to the repository.
