import TestomatioReporter from '@testomatio/reporter';
import chalk from 'chalk';
import { ConsoleEvent, NewmanRunExecution, NewmanRunExecutionAssertion, NewmanRunOptions, NewmanRunSummary } from 'newman';
import { getPrettyTimeFromTimestamp } from './helpers';
import { AnyObject } from "./types";

type TestStatus = 'passed' | 'failed' | 'skipped' | 'finished';
// FIXME: when add chulk to package.json, this reporter does not work. have to investigate and try to fix

const APP_PREFIX = chalk.gray('[TESTOMATIO-NEWMAN-REPORTER]');

/**
 * 
 * @param emitter is an event emitter that triggers the following events: https://github.com/postmanlabs/newman#newmanrunevents
 * @param reporterOptions is an object of the reporter specific options. See usage examples below for more details.
 * @param collectionRunOptions is an object of all the collection run options: https://github.com/postmanlabs/newman#newmanrunoptions-object--callback-function--run-eventemitter
 */
function TestomatioNewmanReporter(emitter: AnyObject, reporterOptions: AnyObject, collectionRunOptions: NewmanRunOptions) {
  // initialize Testomatio reporter
  const testomatioReporter = new TestomatioReporter.TestomatClient({ ...reporterOptions, createNewTests: true });
  let newmanItemStore = {
    authType: '',
    assertionErrorTextColorized: '',
    cookies: '',
    startTime: 0,
    testStatus: '',
    requestBody: '',
    requestURL: '',
    responseBody: '',
    responseTime: 0,
    requestHeaders: '',
    responseCodeAndStatusColorized: '',
  };

  // const envVars = JSON.parse(JSON.stringify(emitter.summary.environment.values)) as KeyValueObject[];
  // const globalVars = JSON.parse(JSON.stringify(emitter.summary.globals.values)) as KeyValueObject[];
  // const allVars = beatifyVariablesList([...globalVars, ...envVars]);

  // listen to the Newman events

  // collection start
  emitter.on('start', function (err: any, newmanRun: NewmanRunExecution) {
    if (err) console.error(err);
    testomatioReporter.createRun();
  });

  // when an item (the whole set of prerequest->request->test) starts
  emitter.on('beforeItem', function (err: any, result: NewmanRunExecution) {
    if (err) console.error(err);

    // reset before each Item (which is the same as Test for Testomatio)
    newmanItemStore = {
      authType: '',
      assertionErrorTextColorized: '',
      requestBody: '',
      cookies: '',
      startTime: new Date().getTime(),
      testStatus: '',
      requestURL: '',
      responseBody: '',
      responseTime: 0,
      requestHeaders: '',
      responseCodeAndStatusColorized: '',
    };
  });
  
  // response received
  emitter.on('request', function (err: any, result: NewmanRunExecution) {
    if (err) {
      console.error(err);
      newmanItemStore.testStatus = 'failed';
    }

    newmanItemStore.authType  = result.request.auth?.toJSON().type || '';
    newmanItemStore.cookies = result.response.cookies.toString();
    newmanItemStore.responseCodeAndStatusColorized = result.response.code < 300 ? chalk.green(result.response.code, result.response.status) : chalk.red(result.response.code, result.response.status);
    newmanItemStore.requestBody = result.request.body?.toString() || '';
    newmanItemStore.requestURL = result.request.url.toString();
    newmanItemStore.requestHeaders = result.request.headers.toString();
    // newmanItemStore.responseBody = JSON.stringify(JSON.parse(result?.response?.stream?.toString() || ''), null, 2);
    newmanItemStore.responseBody = result?.response?.stream?.toString() || '';
    newmanItemStore.responseTime = result.response.responseTime;
  });

  // when an item (the whole set of prerequest->request->test) completes
  emitter.on('item', function (err: AnyObject | null, result: NewmanRunExecution) {
    if (err) {
      console.error(err);
      newmanItemStore.testStatus = 'failed';
    }

    const request = result.item.request;
    // const requestURL = request.url as unknown as URL;

    let steps = '';
    // add assertion error (in case of it)
    steps += newmanItemStore.assertionErrorTextColorized ? `${newmanItemStore.assertionErrorTextColorized}\n\n\n` : '';

    // add request method and url
    // steps += `Request\n${request.method} ${stringifyURL(requestURL, allVars)}`;
    steps += `${chalk.bold('Request')}\n${chalk.blue(request.method)} ${newmanItemStore.requestURL}`;

    // auth type
    steps += newmanItemStore.authType ? `\n\n${chalk.bold('auth: ')}${newmanItemStore.authType}` : '';
    
    // add request headers
    steps += `\n\n${chalk.bold('headers:')}\n${newmanItemStore.requestHeaders}`;
    
    // request body
    steps += newmanItemStore.requestBody ? `\n${chalk.bold('request body:')}\n${newmanItemStore.requestBody}` : '';
    
    // add response status name and code
    steps += newmanItemStore.responseCodeAndStatusColorized ? `\n\n\n${chalk.bold('Response')}\n${newmanItemStore.responseCodeAndStatusColorized}` : '';
    
    // response time
    steps += newmanItemStore.responseTime ? `  (${chalk.italic(newmanItemStore.responseTime)} ms)` : '';

    // add response body
    steps += newmanItemStore.responseBody ? `\n\n${chalk.bold('response body')}:\n${newmanItemStore.responseBody}` : '';

    // add response cookies
    steps += newmanItemStore.cookies ? `\n\n${chalk.bold('cookies')}:\n${newmanItemStore.cookies}` : '';

    // events includes: prerequest, tests etc
    const events = result.item.events;
    events.map(event => {
      const eventName = event.listen;
      const eventScripts = event.script.exec;
      if (eventScripts?.length) steps += `\n\n\n${chalk.blue.bold(eventName)}\n${eventScripts?.join('\n')}`;
    });

    // add execution time
    const executionTime = new Date().getTime() - newmanItemStore.startTime;
    steps += newmanItemStore.startTime ? `\n\n\n${chalk.bold('Execution time: ')}${getPrettyTimeFromTimestamp(executionTime)}s` : '';


    const testData = {
      error: err,
      time: '',
      example: null,
      files: [],
      filesBuffers: [],
      steps,
      title: result.item.name,
      suite_title: typeof collectionRunOptions.collection === 'string' ? collectionRunOptions.collection : collectionRunOptions.collection.name,
      // collection id is passed (looks like uuid); // TODO: pass id with length of 8
      // suite_id: typeof collectionRunOptions.collection === 'string' ? '' : collectionRunOptions?.collection?.id,
    };

    // notify Testomatio about the item result
    testomatioReporter.addTestRun(null, newmanItemStore.testStatus || 'passed' as TestStatus, testData);
  });

  // test assertion
  emitter.on('assertion', function (err: any, assertion: NewmanRunExecutionAssertion) {
    if (err) console.error(err);
    if (assertion.error) {
      newmanItemStore.assertionErrorTextColorized = chalk.red(`${assertion.error.name}: ${assertion.error.message}`);
      newmanItemStore.testStatus = 'failed';
    }
  });

  // every time a console function is called from within any script, this event is propagated
  emitter.on('console', function (err: AnyObject, event: ConsoleEvent) {
    if (err) console.error(err);
    console.log(APP_PREFIX, chalk.grey('CONSOLE:', event.messages.join(' ')));
  });

  // collection run finished
  emitter.on('done', function (err: AnyObject | null, summary: NewmanRunSummary) {
    if (err) console.error(err);

    const status = summary.run.failures.length ? 'failed' : 'passed';
    console.log(APP_PREFIX, chalk.blue('Run result:', status));
    testomatioReporter.updateRunStatus(status);
  });
}

module.exports = TestomatioNewmanReporter;
