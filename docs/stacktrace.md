# Stack Trace

Stack traces are collected automatically from every handled exception of a test.
Testomat.io reporter formats them to include the exact code piece using [callsite-record](https://www.npmjs.com/package/callsite-record) library. This helps quickly identify error.

Here is an example of a code fragment from a stack trace.

```
Test error
   34 |    }
   35 |
   36 |
   37 |    try {
   38 |      ....
 > 39 |      errorFn();
   40 |      expect.fail('Should throw error');
   41 |    } catch (e) {
   42 |      console.log(e);
   43 |      ...
   44 |      ....

   at Context.<anonymous> (/tests/client_test.js:39:7)
```

This stack trace will not include any lines from `node_modules` or from NodeJS internal calls.

### Configuration

* `TESTOMATIO_STACK_IGNORE` - allows to ignore some files or paths from a stack trace. This might be useful if you use custom assertion libraries or other files you would like to not be printed as source of the exception. `TESTOMATIO_STACK_IGNORE` environment variable accepts file name as well `glob` pattern.

Example:

Reject all js files from `tests/support` dir:

```
TESTOMATIO_STACK_IGNORE="tests/support/**.js" <actual-run-command>
```

