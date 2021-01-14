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

**Note: Get the API_KEY from your testomat console**

**Normal run :** Run the test with codecept command `npx codeceptjs run`

## Parallel run

If tests run parallel, like workers in codeceptJS use `start-test-run` command to get proper reports

usage:

`TESTOMATIO=<API_KEY> npx start-test-run -c 'npx codeceptjs run-workers 2'`

-c : Actual test run command

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

## Naming Report and Adding report to group

Give a title to your reports by passing it as environment variable to `TESTOMATIO_TITLE`.

Create/Add run to group by providing `TESTOMATIO_RUNGROUP_TITLE`,

For example

```sh
TESTOMATIO={apiKey} TESTOMATIO_TITLE="title for the report" TESTOMATIO_RUNGROUP_TITLE="Build ${1}" <actual run command>
```

## Store screenshots in third party storage

1. S3 - Provide following configuration from S3 bucket
   **S3_REGION** - Region your bucket lies.
   **S3_BUCKET** - Bucket name.
   **S3_ACCESS_KEY_ID** - Access key.
   **S3_SECRET_ACCESS_KEY** - Secret.

If you are credential files, you can leave last 2 variables

## Development

To change host of endpoint for receiving data, and set it to other than app.testomat.io use `TESTOMATIO_URL` environment variable:

```
TESTOMATIO_URL=http://127.0.0.1:3000
```
