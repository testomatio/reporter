# Logger
- intercepts all logger messages (console, winston, etc., specified by user)
- attaches intercepted log messages to your report
- provides own methods to add any info to your report (like logger.info(), logger.debug(), etc.)
- has varied and convenient syntax
- automatically converts any data to human readable format

The logger supports next methods: `assert`, `debug`, `error`, `info`, `log`, `trace`, and `warn`.

## Usage
```const { logger } = require('@testomatio/reporter')```


### Intercept logger
```javascript
const logger = require('./logger');

logger.intercept(console);

describe('Your suite', () => {
  test('Your test', async () => {
    await page.login();
    console.log('Login successful');
    assert(something);
  });
```
Result: the message 'Login successful' will be added to your report.

Logger can intercept any logger (e.g. pino, loglevel, morgan, tracer, winston etc.). And even multiple loggers at the same time.

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

If you intercept logger, it does not affect your logger settings (e.g. log level). But if you start intercep multiple loggers, the last intercepted will be used as console output.

### Log anything and attach to report 
Varied syntax is supported.
Examples:
- #### Tagget template
```log`text ${someVar}```
- #### Standard
```log(`text ${someVar}`)```
- #### Standard with multiple arguments
```log('text', someVar)```

You are not limited to log only text. Log anything you with, including objects. Everything will be converted to human readable format.
