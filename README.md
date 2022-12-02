# @testomatio/reporter

Library for sending test run reports to your [testomat.io](https://testomat.io) project.

## Installation

Get the `{API_KEY}` from testomat.

You can refer sample tests from example folder of this repo. This is a basic example. If you need something full fledged you can refer this [example repo](https://github.com/testomatio/examples).

Add `@testomatio/reporter` package to your project:

```bash
npm i @testomatio/reporter --save
```

For testcafe use testcafe reporter:

```bash
npm i testcafe-reporter-testomatio
```

## Usage

### CodeceptJS

Make sure you load all your tests using [check-test](https://github.com/testomatio/check-tests#cli).

Add plugin to [codecept conf](https://github.com/testomatio/reporter/blob/master/example/codecept/codecept.conf.js#L23):

```javascript
plugins: {
  testomatio: {
    enabled: true,
    require: '@testomatio/reporter/lib/adapter/codecept',
    apiKey: process.env.TESTOMATIO || 'API_KEY', // pass in api key via config or env variable
  }
}
```

Run the following command from you project folder:

```bash
TESTOMATIO={API_KEY} npx codeceptjs run
```

#### CodeceptJS Parallel Run

If tests run parallel, like workers in CodeceptJS use `start-test-run` command to get proper reports:

```bash
TESTOMATIO={API_KEY} npx start-test-run -c 'npx codeceptjs run-workers 2'
```

> Specify a command to run with `-c` option in `start-test-run`

Use `--env-file <envfile>` option to load environment variables from .env file. Inside env file TESTOMATIO credentials like `TESTOMATIO` api key or [S3 config](#attaching-test-artifacts) can be stored.


### Playwright

Add a reporter to Playwright config:

```javascript
reporter: [
  ['list'],
  [
    '@testomatio/reporter/lib/adapter/playwright.js',
    {
      apiKey: process.env.TESTOMATIO,
    },
  ],
];
```

Run the following command from you project folder:

```bash
TESTOMATIO={API_KEY} npx playwright test
```

### Mocha

Load the test using using `check-test` if not done already. Get the test id from testomat account and add it to your mocha test like in this [example](https://github.com/testomatio/reporter/blob/master/example/mocha/test/index.test.js#L4).

Run the following command from you project folder:

```bash
mocha --reporter ./node_modules/testomat-reporter/lib/adapter/mocha.js --reporter-options apiKey={API_KEY}
```

### Jest

Load the test using using `check-test`. Add the test id to your tests like in this [example](https://github.com/testomatio/reporter/blob/master/example/jest/index.test.js#L1).

Add the following line to [jest.config.js](https://github.com/testomatio/reporter/blob/master/example/jest/jest.config.js#L100):

```javascript
reporters: ['default', ['@testomatio/reporter/lib/adapter/jest.js', { apiKey: process.env.TESTOMATIO }]],
```

Run your tests.

### Cucumber

Load you test using [`check-cucumber`](https://github.com/testomatio/check-cucumber).

Run the following command from you project folder:

```bash
TESTOMATIO={API_KEY} ./node_modules/.bin/cucumber-js --format ./node_modules/@testomatio/reporter/lib/adapter/cucumber.js
```

### TestCafe

Load the test using using `check-test`.

Run the following command from you project folder:

```bash
TESTOMATIO={API_KEY} npx testcafe chrome -r testomatio
```

### Cypress

Load the test using using `check-test`.

Register our `cypress-plugin` in `cypress/plugins/index.js`:

```javascript
const testomatioReporter = require('@testomatio/reporter/lib/adapter/cypress-plugin');

/**
 * @type {Cypress.PluginConfig}
 */
module.exports = (on, config) => {
  // `on` is used to hook into various events Cypress emits
  // `config` is the resolved Cypress config

  testomatioReporter(on, config);

  return config;
};
```

Run the following command from you project folder:

```bash
TESTOMATIO={API_KEY} npx cypress run
```

### Protractor

Load the test using using `check-test`.

Add the following lines to [conf.js](https://github.com/angular/protractor/blob/5.4.1/example/conf.js):

```javascript
const JasmineReporter = require('@testomatio/reporter/lib/adapter/jasmine');

exports.config = {
  onPrepare: () => {
    jasmine.getEnv().addReporter(new JasmineReporter({ apiKey: process.env.TESTOMATIO }));
  },
};
```

Run the following command from you project folder:

```bash
TESTOMATIO={API_KEY} npx start-test-run -c 'npx protractor conf.js'
```

### WebdriverIO

Load the test using using `check-test`.

Add the following lines to [wdio.conf.js](https://webdriver.io/docs/configurationfile/):

```javascript
const testomatio = require('@testomatio/reporter/lib/adapter/webdriver');

exports.config = {
  // ...
  reporters: [
    [testomatio, {
      apiKey: $ {
        process.env.TESTOMATIO
      }
    }]
  ]
}
```

For making screenshots on failed tests add the following hook to `wdio.conf.js`:

```js
    afterTest: function (test, context, { error, result, duration, passed, retries }) {
        if (error) {
            browser.takeScreenshot()
        }
    },
```

Run the following command from you project folder:

```bash
TESTOMATIO={API_KEY} npx start-test-run -c 'npx wdio wdio.conf.js'
```

## JUnit Reports

> **Notice** JUnit reports are supported since 0.6.0

Other frameworks and languages are supported via JUnit reports.

JUnit XML format is standard among test runners on various platforms. Testomat.io can load XML reports from test runners and create tests in a project from it. If your framework is not supported yet, generate JUnit report and upload it into Testomat.io

Testomat.io will not only create a run report but also collect all information about tests, including source code, and create tests in a system as regular importer do. The only difference that normal process of Testomat.io import does not require executing tests on import, while importing via repoter requires to have tests executed and XML report provided.

Tested Frameworks:

* JUnit (JUnit)
* Python (Pytest)
* Minitest (Ruby)
* PHPUnit (PHP)
* NUnit (C#)


To import JUnit reports into Testomat.io **NodeJS >=14 is required**.

Package `@testomatio/reporter` should be installed:

```
npm i @testomatio/reporter@latest --save-dev
```


Run your test framework and generate a JUnit report.

Then import XML report into Testomat.io

```
TESTOMATIO={API_KEY} npx report-xml "{pattern}" --lang={lang}
```

* `pattern` - is a glob pattern to match all XML files from report. For instance, `"test/report/**.xml"` or just `report.xml`
* `--lang` option can be specified to identify source code of the project. Example: `--lang=Ruby` or `--lang=Java` or `--lang=Python`. Possible values:
  * `c#`
  * `java`
  * `ruby`
  * `python`
  * `php`
* `--java-tests` option is avaiable for Java projects, and can be set if path to tests is different then `src/test/java`. When this option is enable, `lang` option is automatically set to `java`
* `--env-file <envfile>` option to load environment variables from .env file. Inside env file TESTOMATIO credentials like `TESTOMATIO` api key or [S3 config](#attaching-test-artifacts) can be stored.
* `--timelimit <time>` set a timer to silently kill a long-running reporter process due to network or other issues. For instance, use `--set-timeout=3` to stop process after 3 secs.


> *Notice:* All options from [Advanced Usage](#advanced-usage) are also available for JUnit reporter

Check the list of examples:

#### Example: Pytest

Run pytest tests and generate a report to `report.xml`:

```
pytest --junit-xml report.xml
```

Import report with this command

```
TESTOMATIO={API_KEY} npx report-xml report.xml --lang=python
```

#### Example: JUnit with Maven

Run tests via Maven, make sure JUnit report was configured in `pom.xml`.

```
mvn clean test
```

Import report with this command:

```
TESTOMATIO={API_KEY} npx report-xml "target/surefire-reports/*.xml" --java-tests
```

> You can specify `--java-test` option to set a path to tests if they are located in path other than `src/test/java`

#### Example: NUnit

Generate NUnit XML report and run the following code:

```
TESTOMATIO={API_KEY} npx report-xml "report.xml" --lang="c#"
```

#### Example: Ruby on Rails with Minitest

```ruby
# test_helper.rb:

reporters = [Minitest::Reporters::DefaultReporter.new(color: true)]
# enable JUnit reporter
reporters << Minitest::Reporters::JUnitReporter.new

Minitest::Reporters.use! reporters
```

Launch tests:

```
rails test
```

Import reports from `test/reports` directory:

```
TESTOMATIO={API_KEY} npx report-xml "test/reports/*.xml" --lang ruby
```

### Artifacts

Screenshots or videos from tests are uploaded if a test contains output with a path to file of following format:

```
file://path/to/screenshot.png
```

For instance, inside Java test you can use `System.out.println` to print a path to file that should be uploaded as a screenshot.

```java
System.out.println("file://" + pathToScreenshot);
```

This will produce XML report which contains path to a file:

```xml
<testcase>
  <system-out><![CDATA[
    file://path/to/scrrenshot.png
  ]]></system-out>
</testcase>
```

When uploaded XML report, all files from `file://` will be uploaded to corresponding tests.


## Advanced Usage

### Create Unmatched Tests

Testomat.io will not create tests from the report if they have not been previously imported. To create tests during the report `TESTOMATIO_CREATE` option can be used:

```bash
TESTOMATIO={API_KEY} TESTOMATIO_CREATE=1 <actual run command>
```

### Add Report to Run by ID

This feature is widely used when a run is executed on CI.
A run is created before the test is started and it is marked as `scheduled`. Then
a report is assigned to that run using `TESTOMATIO_RUN` environment variable and `{RUN_ID}` of a run:

```bash
TESTOMATIO={API_KEY} TESTOMATIO_RUN={RUN_ID} <actual run command>
```

### Do Not Finalize Run

If multiple reports are added to the same run, each of them should not finalize the run. 
In this case use `TESTOMATIO_PROCEED=1` environment variable, so the Run will be shown as `Running`

```
TESTOMATIO={API_KEY} TESTOMATIO_PROCEED=1 TESTOMATIO_RUN={RUN_ID} <actual run command>
```

After all reports were attached and run can be execute the following command:

```
TESTOMATIO={API_KEY} TESTOMATIO_RUN={RUN_ID} npx start-test-run --finish
```

### Setting Report Title

Give a title to your reports by passing it as environment variable to `TESTOMATIO_TITLE`.

```bash
TESTOMATIO={API_KEY} TESTOMATIO_TITLE="title for the report" <actual run command>
```

### Adding Report to RunGroup

Create/Add run to group by providing `TESTOMATIO_RUNGROUP_TITLE`:

```sh
TESTOMATIO={API_KEY} TESTOMATIO_RUNGROUP_TITLE="Build ${BUILD_ID}" <actual run command>
```

### Adding Environments to Run

Add environments to run by providing `TESTOMATIO_ENV` as comma seperated values:

```bash
TESTOMATIO={API_KEY} TESTOMATIO_ENV="Windows, Chrome" <actual run command>
```

### Attaching Test Artifacts

To save a test artifacts (screenshots and videos) of a failed test use S3 storage.
Please note, that the **storage is not connected to Testomatio**.
This allows you to store your artifacts on your own account and not expose S3 credentials.

To save screenshots provide a configuration for S3 bucket via environment variables:

- **S3_REGION** - Region your bucket lies.
- **S3_BUCKET** - Bucket name.
- **S3_ACCESS_KEY_ID** - Access key.
- **S3_SECRET_ACCESS_KEY** - Secret.
- **S3_ENDPOINT** - for providers other than AWS

By default tests artifacts are uploaded to bucket with `public-read` permission.
In this case uploaded files will be publicly accessible in Internet.
These public links will be used by [testomat.io](https://testomat.io) to display images and videos.

To upload files with `private` access bucket add `TESTOMATIO_PRIVATE_ARTIFACTS=1` environment value.
Then update provide the same S3 credentials in "Settings > Artifacts" section of a [testomat.io](https://testomat.io) project,
so [testomat.io](https://testomat.io) could connect to the same bucket and fetch uploaded artifacts.
Links to files will be pre-signed and expires automatically in 10 minutes.

Example upload configuration in environment variables:

##### AWS

```bash
TESTOMATIO_PRIVATE_ARTIFACTS=1
S3_ACCESS_KEY_ID=11111111111111111111
S3_SECRET_ACCESS_KEY=2222222222222222222222222222222222222222222
S3_BUCKET=artifacts
S3_REGION=us-west-1
```

##### DigitalOcean

```bash
TESTOMATIO_PRIVATE_ARTIFACTS=1
S3_ENDPOINT=https://ams3.digitaloceanspaces.com
S3_ACCESS_KEY_ID=11111111111111111111
S3_SECRET_ACCESS_KEY=2222222222222222222222222222222222222222222
S3_BUCKET=artifacts
S3_REGION=ams3
```

##### Minio

```bash
S3_ENDPOINT=http://company.storage.com
S3_ACCESS_KEY_ID=minio
S3_SECRET_ACCESS_KEY=minio123
S3_BUCKET=testomatio
S3_FORCE_PATH_STYLE=true
```

> It is important to add S3_FORCE_PATH_STYLE var for minio setup

For local testing, it is recommended to store configuration in `.env` file. If you load configuration from a test runner, use [dotenv](https://www.npmjs.com/package/dotenv) library to load it.

If you run a reporter via `start-test-run` or `report-xml` command use `--env-file` option to load variables from .env file:

```
npx start-test-run --env-file .env
npx report-xml --env-file .env
```

On CI set environment variables in CI config.

Test artifacts are automatically uploaded for these test runners:

- CodeceptJS
- Playwright
- Cypress
- WebdriverIO

To manually attach an artifact and upload it for a test use `global.testomatioArtifacts` array:

```javascript
// attach a picture inside a test
global.testomatioArtifacts.push('img/file.png');
// attach a picture and add a name to it
global.testomatioArtifacts.push({ name: 'Screenshot', path: 'img/file.png' });
```

Artifacts will be uploaded for the current test when it is finished.

To disable uploading artifacts add `TESTOMATIO_DISABLE_ARTIFACTS` environment variable:

```bash
TESTOMATIO_DISABLE_ARTIFACTS=1
```

### Starting an Empty Run

If you want to create a run and obtain its `{RUN_ID}` from [testomat.io](https://testomat.io) you can use `--launch` option:

```bash
TESTOMATIO={API_KEY} npx start-test-run --launch
```

This command will return `{RUN_ID}` which you can pass to other testrunner processes.

> When executed with `--launch` a command provided by `-c` flag is ignored

### Manually Finishing Run

If you want to finish a run started by `--launch` use `--finish` option. `TESTOMATIO_RUN` environment variable is required:

```bash
TESTOMATIO={API_KEY} TESTOMATIO_RUN={RUN_ID} npx start-test-run --finish
```
