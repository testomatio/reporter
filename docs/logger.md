# Logger

- intercepts `console` logs by default
- intercepts any logger messages (winston, pino, etc., specified by user))
- attaches intercepted log messages to your report
- provides own methods to add any info to your report (like `logger.info()`, `logger.debug()`, etc.)
- has a varied and convenient syntax
- automatically converts any data to human-readable format

> Please check if your framework supported in the list below [Supported frameworks](#supported-frameworks)

For proper logger work, your tests titles should contain testomatio test ids ([see details](https://docs.testomat.io/usage/continuous-integration/#assigning-ids)).

The logger supports next methods: `assert`, `debug`, `error`, `info`, `log`, `trace` and `warn`.

Logging functionality is represented by 2 entitites:

Logger has ability to intercept other loggers. [usage](#usage)

## Usage

Log messages with different levels:

```javascript
const { logger } = require('@testomatio/reporter');
// or
import { logger } from '@testomatio/reporter';

logger.info('message');
logger.error('message');
```

Logger allows configuration (See [Configuration](#configuration) section for details).

### Convenient syntax with "log" function
```javascript
const { log } = require('@testomatio/reporter');

test('Your test @T12345678', async () => {
  await page.login(user);
  log`I was logged in with user ${user}`; // <<<<<
  assert(loggedIn);
});
```
More examples:
```javascript
const { log } = require('@testomatio/reporter');
// or 
import { log } from '@testomatio/reporter';

log`your message`;
log`your message ${variable}`;
```


### Intercept logs from your logger (and attach them to testomatio report)

```javascript
const { logger } = require('@testomatio/reporter')

logger.intercept(console); // intercept console

describe('Your suite @S12345678', () => {
  test('Your test @T12345678', async () => {
    await page.login();
    console.log('this message will be intercepted and added to your report'); // <<
    assert(something);
  });
```

Pass the logger object you want to intercept, not its name:\
✅ `logger.intercept(pino)`\
❌ `logger.intercept('pino')`

NodeJS `console` is intercepted by default for some frameworks (CodeceptJS, Cucumber), to add console logs to your report just import logger in your test file and use console as usual. For other frameworks you need to set `TESTOMATIO_INTERCEPT_CONSOLE_LOGS` env variable to any truthy value. Or intercept console (or any other logger) manually (see examples above or below).

### Examples for other loggers intercepting

```javascript
const logLevel = require('loglevel');
const pino = require('pino')();
const morgan = require('morgan');
const tracer = require('tracer').console();
const tracerColor = require('tracer').colorConsole();

logger.intercept(logLevel);
logger.intercept(pino);
logger.intercept(morgan);
logger.intercept(tracer);
logger.intercept(tracerColor);
```

> Note: if you import testomatio logger as "logger", be sure not to import other loggers as "logger" too. Otherwise, you will get an error.

## Configuration

After you import logger, you can configure it:

```javascript
const { logger } = require('@testomatio/reporter');
loggger.configure({
  logLevel: 'WARN',
  prettyObjects: true,
});
```

List of available options:

- `prettyObjects` [boolean] - if true, objects will be printed on multiple lines (easier to read). Default: `false` (object are printed on one line)
- `logLevel` [error, warn, log, info, debug, trace, verbose, all] - ignores messages below the log level set. Also could be set by `LOG_LEVEL` env variable. Default: `all`

### Supported frameworks

This feature is under development right now. List of supported frameworks:

- 🟢 CodeceptJS
- 🔴 Cypress
- 🟢 Cucumber
- 🟢 Jest
- 🟢 Mocha
- 🟢 Newman (Postman) (console logs are added by testomatio reporter by default, no need to use logger)
- 🟢 Playwright
- 🟢 Puppeteer (using Jest)
- 🔴 WebdriverIO
