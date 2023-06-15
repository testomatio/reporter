## Frameworks

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

> **Note**
> `newman` and `newman-reporter-testomatio` should be installed in the same directory. If you run your tests using globally installed newman (`newman run ...`), intall `newman-reporter-testomatio` globally too (`npm i newman-reporter-testomatio -g`). If you use locally installed newman (within the project) (`npx newman run ...`), install `newman-reporter-testomatio` locally (`npm i newman-reporter-testomatio`).
You can verify installed packages via `npm list` or `npm list -g`.


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