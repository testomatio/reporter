## JavaScript Frameworks

Testomat.io reporter is NodeJS package that can be applied to all popular JavaScript test runners.

### CodeceptJS

> 📐 When used with [Testomat.io Application](https://app.testomat.io) it is recommended to import automated tests first via [check-tests](https://github.com/testomatio/check-tests#cli). To create items on the fly set `TESTOMATIO_CREATE=1` env variable.

Add plugin to [codecept conf](https://github.com/testomatio/reporter/blob/master/example/codecept/codecept.conf.js#L23):

```javascript
plugins: {
  testomatio: {
    enabled: true,
    require: '@testomatio/reporter/lib/adapter/codecept',
  }
}
```

Run the following command from you project folder:

```bash
TESTOMATIO={API_KEY} npx codeceptjs run
```

> 🖼 Screenshots of failed tests and videos (for Playwright helper) will be automatically uploaded as [Artifacts](./artifacts.md)

#### CodeceptJS Parallel Run

If tests run parallel, like workers in CodeceptJS use `start-test-run` command to get proper reports:

```bash
TESTOMATIO={API_KEY} npx start-test-run -c 'npx codeceptjs run-workers 2'
```

> Specify a command to run with `-c` option in `start-test-run`

Use `--env-file <envfile>` option to load environment variables from .env file. Inside env file TESTOMATIO credentials like `TESTOMATIO` api key or [S3 config for artifacts](./artifacts).

Command `start-test-run` is used to initiate a single run report before all workers are started. Each worker will report to the same Run, and after all workers and codeceptjs finishes, this will finish the run report.

> 📑 [Example Project](https://github.com/testomatio/examples/tree/master/codeceptJS) | 🗄 [CodeceptJS API Example](https://github.com/testomatio/examples/tree/master/codeceptJSApi) | 🥒 [CodeceptJS Cucumber Example](https://github.com/testomatio/examples/tree/master/codeceptjs-cucumber)

> 📺 [Video](https://www.youtube.com/watch?v=f_pCe3wPRPs)

### Playwright

> 📐 When used with [Testomat.io Application](https://app.testomat.io) it is recommended to import automated tests first via [check-tests](https://github.com/testomatio/check-tests#cli). To create items on the fly set `TESTOMATIO_CREATE=1` env variable.

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

> 🖼 Screenshots of failed tests and videos will be automatically uploaded as [Artifacts](./artifacts.md)

> 📑 [Example Project](https://github.com/testomatio/examples/tree/master/playwright) | 🥒 [Playwright + Cucumber Example](https://github.com/testomatio/examples/tree/master/playwright-cucumber-js)

### Cypress

> 📐 When used with [Testomat.io Application](https://app.testomat.io) it is recommended to import automated tests first via [check-tests](https://github.com/testomatio/check-tests#cli). To create items on the fly set `TESTOMATIO_CREATE=1` env variable.

<details>
  <summary> For Cypress <code>< 10.0.0</code> <i>(click to expand)</i></summary>
  Register `cypress-plugin` in `cypress/plugins/index.js`:

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

</details>

For Cypress >= `10.0.0` use `setupNodeEvents` in `cypress.config.js(ts)`

```javascript
setupNodeEvents(on, config) {
  return require('@testomatio/reporter/lib/adapter/cypress-plugin')(on, config)
}
```

Run the following command from you project folder:

```bash
TESTOMATIO={API_KEY} npx cypress run
```

> 🖼 Screenshots of failed tests and videos will be automatically uploaded as [Artifacts](./artifacts.md)

> 📑 [Example Project](https://github.com/testomatio/examples/tree/master/cypress) | 🥒 [Cypress + Cucumber Example](https://github.com/testomatio/examples/tree/master/cypress-cucumber)

### Mocha

> 📐 When used with [Testomat.io Application](https://app.testomat.io) it is recommended to import automated tests first via [check-tests](https://github.com/testomatio/check-tests#cli). To create items on the fly set `TESTOMATIO_CREATE=1` env variable.

Run the following command from you project folder:

```bash
mocha --reporter ./node_modules/@testomatio/reporter/lib/adapter/mocha.js --reporter-options apiKey={API_KEY}
```

> 📑 [Example Project](https://github.com/testomatio/examples/tree/master/mocha-ts-multi-reporters)

### Jest

> 📐 When used with [Testomat.io Application](https://app.testomat.io) it is recommended to import automated tests first via [check-tests](https://github.com/testomatio/check-tests#cli). To create items on the fly set `TESTOMATIO_CREATE=1` env variable.

Add the following line to [jest.config.js](https://github.com/testomatio/reporter/blob/master/example/jest/jest.config.js#L100):

```javascript
reporters: ['default', ['@testomatio/reporter/lib/adapter/jest.js', { apiKey: process.env.TESTOMATIO }]],
```

Run tests:

```
TESTOMATIO={API_KEY} npx jest
```

> **Warning**
> Do not use `bail` option in your jest config or testrun script. (It cause issues with updating testrun status).

> 📑 [Example Project](https://github.com/testomatio/examples/tree/master/jest)

> 📺 [Video](https://www.youtube.com/watch?v=RKfIfnEuGys)

### WebdriverIO

> 📐 When used with [Testomat.io Application](https://app.testomat.io) it is recommended to import automated tests first via [check-tests](https://github.com/testomatio/check-tests#cli). To create items on the fly set `TESTOMATIO_CREATE=1` env variable.

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

> 📑 [Example Project](https://github.com/testomatio/examples/tree/master/webdriverio-mocha)

> 📺 [Video](https://www.youtube.com/watch?v=cjVZzey-lto)

### Cucumber

> 📐 When used with [Testomat.io Application](https://app.testomat.io) it is recommended to import feature files via [check-cucumber](https://github.com/testomatio/check-cucumber).

Run the following command from you project folder:

```bash
TESTOMATIO={API_KEY} npx cucumber-js --format ./node_modules/@testomatio/reporter/lib/adapter/cucumber.js
```

> **Note**
> If you use Cucumber with Playwright, Cypress, CodeceptJS, please refer to corresponding framework. This reference is required only if you run tests via `cucumber-js` CLI.

> 📑 [Example Project](https://github.com/testomatio/examples/tree/master/cucumber)

> 📺 [Video](https://www.youtube.com/watch?v=qf83AtII-LI)

### TestCafe

> 📐 When used with [Testomat.io Application](https://app.testomat.io) it is recommended to import automated tests first via [check-tests](https://github.com/testomatio/check-tests#cli). To create items on the fly set `TESTOMATIO_CREATE=1` env variable.

Run the following command from you project folder:

```bash
TESTOMATIO={API_KEY} npx testcafe chrome -r testomatio
```

### Newman

To report Newman tests a separate package is required:

```bash
npm i newman-reporter-testomatio --save-dev
```

> **Note** > `newman` and `newman-reporter-testomatio` should be installed in the same directory. If you run your tests using globally installed newman (`newman run ...`), intall `newman-reporter-testomatio` globally too (`npm i newman-reporter-testomatio -g`). If you use locally installed newman (within the project) (`npx newman run ...`), install `newman-reporter-testomatio` locally (`npm i newman-reporter-testomatio`).
> You can verify installed packages via `npm list` or `npm list -g`.

Run collection and specify `testomatio` as reporter:

```bash
TESTOMATIO={API_KEY} npx newman run {collection_name.json} -r testomatio
```

> 📑 [Example Project](https://github.com/testomatio/examples/tree/master/newman)

### Detox

> 📐 When used with [Testomat.io Application](https://app.testomat.io) it is recommended to import automated tests first via [check-tests](https://github.com/testomatio/check-tests#cli). To create items on the fly set `TESTOMATIO_CREATE=1` env variable.

Run detox tests sptcifying configuration name:

```
TESTOMATIO={API_KEY} npx detox test -c {configuration_name}
```

> **Warning**
> Do not use `bail` option in your jest config or testrun script. (It cause issues with updating testrun status).

### Protractor

> 📐 When used with [Testomat.io Application](https://app.testomat.io) it is recommended to import automated tests first via [check-tests](https://github.com/testomatio/check-tests#cli). To create items on the fly set `TESTOMATIO_CREATE=1` env variable.

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

> 📑 [Example Project](https://github.com/testomatio/examples/tree/master/protractor)

## Java Frameworks

> 📐 This section describes reporting into [Testomat.io Application](https://app.testomat.io)

Reporting from Java Frameworks is done via JUnit XML report. Install `@testomatio/reporter` NodeJS package to process reports:

```
npm init -y
npm install @testomatio/reporter --save-dev
```

JUnit XML report can be created by test framework you use:

### JUnit

If you run JUnit tests via Maven you can use [Surefire Report Plugin](https://maven.apache.org/surefire/maven-surefire-report-plugin/usage.html) to generate JUnit XML report.

For example, with Surefire Report Plugin in Maven, you can add the following configuration to your project's `pom.xml`:

```xml
<build>
    <plugins>
        <plugin>
            <groupId>org.apache.maven.plugins</groupId>
            <artifactId>maven-surefire-plugin</artifactId>
            <version>3.0.0-M5</version>
        </plugin>
    </plugins>
</build>
```

In this case JUnit XML will be saved into `target/surefire-reports/`

So you can import reports to Testomat.io by running:

```
TESTOMATIO={API_KEY} npx report-xml "target/surefire-reports/**.xml" --java-tests
```

> **Note**
> If your tests are located in a folder other other than `src/test/java`, specify a path to test files using `--java-tests` option: `--java-tests="path/to/tests"`

This will import test reports into Testomat.io. If a reporter can access source code of Java tests, the source code will also be imported into Testomat.io

#### Test IDS

It is possible to attach reported tests to the current tests in Testomat.io by their IDs. Copy Test ID of a test you want to match, and put it as a comment into a Java test you want to import.

In this example, we added ID as a comment to `negativeNumbersCanBeSubtracted` test:

```java
  @Test
  public void negativeNumbersCanBeSubtracted() throws Exception {
      // @T8acca9eb
      assertThat(calc.Calculate(-1.0, -3.0, "-"), equalTo(2.0));
  }
```

To make this feature work, please ensure that source code of Java tests is accessible to `npx report-xml` command, use `--java-tests` option to specify the correct path. To check if source code of tests is available run reporter with DEBUG mode:

```
DEBUG=@testomatio/reporter:* TESTOMATIO={API_KEY} npx report-xml "target/surefire-reports/**.xml" --java-tests
```

Is a source code is not available, test IDs can be set from output. To set Test ID to a test, copy test ID and print it from a test:

```java
System.out.println("tid://" + TID);
```

For example, if your test id is `@T8acca9eb` you can print it:

```java
System.out.println("tid://@T8acca9eb");
```

#### Artifacts

Screenshots or videos from tests are uploaded if test contains output with a path to file of following format:

```
file://path/to/screenshot.png
```

Use `System.out.println` to print an absulute path to file that should be uploaded as a screenshot.

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

When XML report is uploaded, all files from `file://` will be uploaded to corresponding tests.

> 🖼 Read more how [Artifacts](./artifacts.md) work

### Selenide

Please refer to [JUnit](#junit) if you use JUnit as a test runner for Selenide tests.
However, it is important to note, that Selenide automatically adds artifacts into JUnit reports printing them as `file://` into XML report. This means that no code changes should be made to publish artifacts to Testomat.io.

### Cucumber Java

If you use Java version of Cucumber Java you should import your feature files first using [check-cucumber](npmjs.com/package/check-cucumber).
Provide a path to directory containing feature files by using `-d` option:

```
TESTOMATIO={API_KEY} npx check-cucumber -d features
```

It is recommended to set Test IDs for Cucumber scenarios to make reports match imported tests.

```
TESTOMATIO_TITLE_IDS=1 TESTOMATIO={API_KEY} npx check-cucumber -d features --update-ids
```

We use `--update-ids` option to write test IDs obtained from Testomat.io into source code
Also we use `TESTOMATIO_TITLE_IDS=1` to write test IDs into scenario titles instead of scenario tags. This is important so JUnit report would contain test IDs.

To generate JUnit reports, you can use the built-in Cucumber JUnit plugin. When you run your Cucumber tests the JUnit reports will be generated in the default directory (`build/reports/tests/test`) in XML format.

To submit report to Testomat.io use `npx report-xml` command from `@testomatio/reporter` NodeJS package:

```
TESTOMATIO={API_KEY} npx report-xml "build/reports/tests/**/*.xml"
```

If you want to have artifacts attached, use `System.out.println` to print an absulute path to file that should be uploaded as a screenshot.

```java
System.out.println("file://" + pathToScreenshot);
```
