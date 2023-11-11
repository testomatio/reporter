# Environment variables
You can pass environment variables to the testomat.io reporter using the following syntax:

```bash TESTOMATIO={API_KEY} <actual run command>```

When running on CI, use secrets.

To read environment variables from `.env` file, use [dotenv](https://www.npmjs.com/package/dotenv) package. And read the env file via:
```javascript
require('dotenv').config({ path: '.env' }); // or any other path
```


## Variables list:
| Name | Description | Example |
| --- | --- | --- |
| `TESTOMATIO` | Your api key. |
| `TESTOMATIO_STACK_FILTER` |  |
| `TESTOMATIO_CSV_FILENAME` |  |
| `TESTOMATIO_CREATE` | Create test ids. |
| `TESTOMATIO_TITLE_IDS` |  |
| `TESTOMATIO_RUN` | Add Report to Run by ID |
| `TESTOMATIO_PROCEED` | Do Not Finalize Run |
| `TESTOMATIO_TITLE` | Setting Report Title | `TESTOMATIO={API_KEY} TESTOMATIO_TITLE="title for the report" <actual run command>`
| `TESTOMATIO_SHARED_RUN` | Reporting Parallel Execution to To Same Run | `TESTOMATIO={API_KEY} TESTOMATIO_TITLE="report for commit ${GIT_COMMIT}" TESTOMATIO_SHARED_RUN=1 <actual run command>`
| `TESTOMATIO_RUNGROUP_TITLE` | Adding Report to RunGroup | `TESTOMATIO={API_KEY} TESTOMATIO_RUNGROUP_TITLE="Build ${BUILD_ID}" <actual run command>`
| `TESTOMATIO_ENV` | Adding Environments to Run | `TESTOMATIO={API_KEY} TESTOMATIO_ENV="Windows, Chrome" <actual run command>`
| Artifacts | |
| `S3_ENDPOINT` |  |
| `S3_ACCESS_KEY_ID` |  |
| `S3_SECRET_ACCESS_KEY` |  |
| `S3_BUCKET` |  |
| `S3_REGION` |  |
| Pipes | |
| `GH_PAT` |  |
| `GITLAB_PAT` |  |
