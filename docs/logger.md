# Logger
- intercepts all logger messages (console, winston, etc., specified by user)
- attaches intercepted log messages to your report
- provides own methods to add any info to your report (like logger.info(), logger.debug(), etc.)
- has a varied and convenient syntax
- automatically converts any data to human-readable format

The logger supports the next methods: `assert`, `debug`, `error`, `info`, `log`, `trace`, and `warn`.

## Usage
For logs intercepting:
```javascript
const { logger } = require('@testomatio/reporter')
```

For logging:
```javascript
const { log } = require('@testomatio/reporter')
```


## Intercept logger
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
Result: the message 'Login successful' will be added to your report.

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

If you intercept logger, it does not affect your logger settings (e.g. log level). But if you start intercept multiple loggers, the last intercepted will be used as console output.

## Log anything and attach it to report 

```javascript
const {log} = require('./logger');

logger.intercept(console);

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
