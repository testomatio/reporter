# Logger
- intercepts any logger messages (console, winston, etc., specified by user)
- attaches intercepted log messages to your report
- provides own methods to add any info to your report (like `logger.info()`, `logger.debug()`, etc.)
- has a varied and convenient syntax
- automatically converts any data to human-readable format

> Please check if your framework supported in the list below [Supported frameworks](#supported-frameworks)

The logger supports next methods: `assert`, `debug`, `error`, `info`, `log`, `trace` and `warn`.


Logging functionality is represented by 2 entitites:
- `logger` object - main logger object with ability to intercept other loggers and configuration [usage](#usage)
- `log` function – simple function to log messages (`log('message')` or `log\`message`\`) [usage](#simple-syntax)

## Usage
Log messages with different levels:
```javascript
const { logger } = require('@testomatio/reporter')
logger.info('message');
logger.error('message');
```
<!-- 
Shorter syntax:
```javascript
const { log } = require('@testomatio/reporter')
log('message');
``` -->

Logger allows configuration (See [Configuration](#configuration) section for details).

### Intercept logs from your logger (and attach them to testomatio report)
```javascript
const { logger } = require('@testomatio/reporter')

logger.intercept(console); // intercept console

describe('Your suite @S12345678', () => {
  test('Your test @T12345678', async () => {
    await page.login();
    console.log('Login successful'); // this message will be intercepted and added to your report
    assert(something);
  });
```

Logger can intercept any logger (e.g. pino, loglevel, morgan, tracer, winston, etc.). And even multiple loggers at the same time.

### Examples for other loggers intercepting
```javascript
const logLevel = require('loglevel');
const pino = require('pino')();
const morgan = require('morgan')
const tracer = require('tracer').console()
const tracerColor = require('tracer').colorConsole();

logger.intercept(logLevel);
logger.intercept(pino);
logger.intercept(morgan);
logger.intercept(tracer);
logger.intercept(tracerColor);
```

> Note: if you import testomatio logger as "logger", be sure not to import other loggers as "logger" too. Otherwise, you will get an error.

## Simple syntax
```javascript
const { log } = require('./logger');

describe('Your suite @S12345678', () => {
  test('Your test @T12345678', async () => {
    await page.login();
    log`Login successful`; // <<<<<
    assert(something);
  });
```

Varied syntax is supported. Use which you prefer. Examples:
- #### Tagged template
```javascript
log`Successful login`
log`Successful login with user ${userName}
```
- #### Standard
```javascript
log('Successful login')
log(`Successful login with user ${userName}`)
```
- #### Standard with multiple arguments
```javascript
log('Successful login with user', userName, userAge)
```

You are not limited to log only text. Log anything you wish, including objects. Everything will be converted to human-readable format.

## Configuration
After you import logger, you can configure it:
```javascript
const { logger } = require('@testomatio/reporter')
loggger.configure({
  logLevel: 'WARN',
  prettyObjects: true,
})
```

List of available options:
- `prettyObjects` [boolean] - if true, objects will be printed on multiple lines (easier to read). Default: `false` (object are printed on one line)
- `logLevel` [error, warn, log, info, debug, trace, verbose, all] - ignores messages below the log level set. Also could be set by `LOG_LEVEL` env variable. Default: `all`

### Supported frameworks
This feature is under development right now. List of supported frameworks:
🟢 - full support, 🟡 - partial support, 🔴 - no support yet
- 🟢 CodeceptJS
- 🔴 Cypress
- 🟢 Cucumber
- 🟢 Jest
- 🔴 Mocha
- 🟢 Newman (Postman)
  - console logs are added by testomatio reporter by default, no need to use logger
- 🟢 Playwright
- 🔴 Protractor
- 🟢 Puppeteer (using Jest)
- 🔴 WebdriverIO

## Step
You can add a step to your test:
```javascript
const { step } = require('@testomatio/reporter');
describe('Your suite @S12345678', () => {
  test('Your test @T12345678', async () => {
    await page.login();
    step`Login successful` // <<<<<
    assert(something);
  });
```
It will also be attached to your report and helps to understand the test flow.

##### Minor comments
If you intercept logger, it does not affect your logger settings (e.g. log level). But if you start intercept multiple loggers, the last intercepted will be used as output to terminal where your tests executed.
