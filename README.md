# @testomatio/reporter

Send test run reports to your testomat.io project. Get the API key from testomat.

You can refer sample tests from example folder of this repo. This is a basic example. If you need something full fledged you can refer this [example repo](https://github.com/testomatio/examples)

Add `@testomatio/reporter` package to your project:

```
npm i @testomatio/reporter --save
```

For testcafe use testcafe reporter

```
npm i testcafe-reporter-testomatio
```

## CodeceptJS

Make sure you load all your tests using [check-test](https://github.com/testomatio/check-tests#cli).

Add plugin to [codecept conf](https://github.com/testomatio/reporter/blob/master/example/codecept/codecept.conf.js#L23)

```js
plugins: {
  testomatio: {
    enabled: true,
    require: '@testomatio/reporter/lib/adapter/codecept',
    apiKey: process.env.API_KEY || 'API_KEY', // pass in api key via config or env variable
  }
}
```

> **Get the API_KEY from your testomat console**

Run tests with

```
TESTOMATIO=<API_KEY> npx codeceptjs run`
```

### CodeceptJS Parallel Run

If tests run parallel, like workers in codeceptJS use `start-test-run` command to get proper reports

```
TESTOMATIO=<API_KEY> npx start-test-run -c 'npx codeceptjs run-workers 2'
```

> Specify a command to run with `-c` option in `start-test-run`

## Playwright

Add a reporter to Playwright config:

```
  reporter: [
    ['list'],
    ['@testomatio/reporter/lib/adapter/playwright.js', {
      apiKey: process.env.TESTOMATIO,
    }]
  ]
```

Execute tests providing Api Key as TESTOMATIO environment variables:

```
TESTOMATIO=<API_KEY> npx playwright test
```

## Mocha

Load the test using using `check-test` if not done already. Get the test id from testomat account and add it to your mocha test like in this [example](https://github.com/testomatio/reporter/blob/master/example/mocha/test/index.test.js#L4)

run the following command from you project folder

```sh
mocha --reporter ./node_modules/testomat-reporter/lib/adapter/mocha.js  --reporter-options apiKey=API_KEY
```

## Jest

Load the test using using `check-test` . Add the test id to your tests like in this [example](https://github.com/testomatio/reporter/blob/master/example/jest/index.test.js#L1)

Add the following line to [jest.config.js](https://github.com/testomatio/reporter/blob/master/example/jest/jest.config.js#L100)

`reporters: ['default', ['../../lib/adapter/jest.js', { apiKey: API_KEY }]],`

Run your tests.

## Cucumber

Load you test using [`check-cucumber`](https://github.com/testomatio/check-cucumber)

Run cucumber test with this formatter and API key in environment in `TESTOMATIO`

```sh
TESTOMATIO=api_key ./node_modules/.bin/cucumber-js --format ./node_modules/@testomatio/reporter/lib/adapter/cucumber.js
```

## TestCafe

Load the test using using `check-test` .

run the following command from you project folder

```sh
TESTOMATIO={apiKey} npx testcafe chrome -r testomatio
```

## Protractor

Load the test using using `check-test` .

Add the following line to [conf.js](https://github.com/angular/protractor/blob/5.4.1/example/conf.js)

```js
const JasmineReporter = require("@testomatio/reporter/lib/adapter/jasmine");

exports.config = {
  onPrepare: () => {
    jasmine
      .getEnv()
      .addReporter(new JasmineReporter({ apiKey: process.env.TESTOMATIO }));
  },
};
```

run the following command from you project folder

```sh
TESTOMATIO={apiKey}  npx @testomatio/reporter@latest -c 'npx protractor conf.js'
```

# Advanced Usage

## Adding Report to Run by ID

This feature is widely used when a run is executed on CI.
A run is created before the test is started and it is marked as `scheduled`. Then
a report is assigned to that run using `TESTOMATIO_RUN` environment variable and ID of a run:

```sh
TESTOMATIO={apiKey} TESTOMATIO_RUN={runId} <actual run command>
```

## Setting Report Title

Give a title to your reports by passing it as environment variable to `TESTOMATIO_TITLE`.

```sh
TESTOMATIO={apiKey} TESTOMATIO_TITLE="title for the report" <actual run command>
```

## Adding Report to RunGroup

Create/Add run to group by providing `TESTOMATIO_RUNGROUP_TITLE`:

```sh
TESTOMATIO={apiKey} TESTOMATIO_RUNGROUP_TITLE="Build ${BUILD_ID}" <actual run command>
```

## Adding Environments to Run

Add environments to run by providing `TESTOMATIO_ENV` as comma seperated values:

```sh
TESTOMATIO={apiKey} TESTOMATIO_ENV="Windows, Chrome" <actual run command>
```

## Attaching Screenshots

To save a screenshot of a failed test use S3 storage.
Please note, that the **storage is not connected to Testomatio**.
This allows you to store your artifacts on your own account and not expose S3 credentials.

To save screenshots provide a configuration for S3 bucket via environment variables.

- **S3_REGION** - Region your bucket lies.
- **S3_BUCKET** - Bucket name.
- **S3_ACCESS_KEY_ID** - Access key.
- **S3_SECRET_ACCESS_KEY** - Secret.
- **S3_ENDPOINT** - for providers other than AWS

> AWS S3 bucket is required to have `public-read` permission to operate. Public links are used by Testomatio to display screenshots in UI.

For local testing, it is recommended to store this configuration in `.env` file and load it with [dotenv](https://www.npmjs.com/package/dotenv) library.

On CI set environment variables in CI config.


## Starting an Empty Run

If you want to create a run and obtain its RunID from Testomat.io you can use `--launch` option:

```sh
TESTOMATIO={apiKey} npx @testomatio/reporter@latest --launch
```

This command will return RunID which you can pass to other testrunner processes.

> When executed with `--launch` a command provided by `-c` flag is ignored

## Manually Finishing Run

If you want to finish a run started by `--launch` use `--finish` option. `TESTOMATIO_RUN` environment variable is required:

```sh
TESTOMATIO={apiKey} TESTOMATIO_RUN={runId} npx @testomatio/reporter@latest --finish
```

