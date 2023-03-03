import TestomatioReporter from '@testomatio/reporter';
import chalk from 'chalk';
import { ConsoleEvent, NewmanRunExecution, NewmanRunExecutionAssertion, NewmanRunOptions, NewmanRunSummary } from 'newman';
import { beatifyVariablesList } from './helpers';
import { AnyObject, KeyValueObject } from "./types";
import { stringifyURL, URL } from './url-parser';

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
  let responseCodeAndStatusColorized = '';
  let assertionErrorTextColorized = '';

  const envVars = JSON.parse(JSON.stringify(emitter.summary.environment.values)) as KeyValueObject[];
  const globalVars = JSON.parse(JSON.stringify(emitter.summary.globals.values)) as KeyValueObject[];
  const allVars = beatifyVariablesList([...globalVars, ...envVars]);

  // listen to the Newman events

  // collection start
  emitter.on('start', function (err: any, newmanRun: NewmanRunExecution) {
    testomatioReporter.createRun();
  });

  // when an item (the whole set of prerequest->request->test) starts
  emitter.on('beforeItem', function (err: any, result: NewmanRunExecution) {
    if (err) console.error(err);
    // reset before each Item (which is the same as Test for Testomatio)
    responseCodeAndStatusColorized = '';
    assertionErrorTextColorized = '';
  });

  // response received
  emitter.on('request', function (err: any, result: NewmanRunExecution) {
    if (err) console.error(err);
    if (!result.response) return;
    responseCodeAndStatusColorized = result.response.code < 300 ? chalk.green(result.response.code, result.response.status) : chalk.red(result.response.code, result.response.status);
  });

  // when an item (the whole set of prerequest->request->test) completes
  emitter.on('item', function (err: AnyObject | null, result: NewmanRunExecution) {
    if (err) console.error(err);

    const request = result.item.request;
    const requestURL = request.url as unknown as URL;

    let steps = '';
    // add request method and url
    steps += `request\n${request.method} ${stringifyURL(requestURL, allVars)}`;
    // add response status name and code
    steps += responseCodeAndStatusColorized ? `\nresponse\n${responseCodeAndStatusColorized}` : '';
    // add assertion error
    steps += assertionErrorTextColorized ? `\n\n\n${assertionErrorTextColorized}` : '';

    // events includes prerequest, tests etc
    const events = result.item.events;
    events.map(event => {
      const eventName = event.listen;
      const eventScripts = event.script.exec;
      if (eventScripts?.length) steps += `\n\n\n${chalk.blue(eventName)}\n${chalk.grey(eventScripts?.join('\n'))}`;
    });

    const testData = {
      error: err,
      time: '',
      example: null,
      files: [],
      filesBuffers: [],
      steps,
      title: result.item.name,
      suite_title: typeof collectionRunOptions.collection === 'string' ? collectionRunOptions.collection : collectionRunOptions.collection.name,
      suite_id: typeof collectionRunOptions.collection === 'string' ? '' : collectionRunOptions?.collection?.id,
    };

    // notify Testomatio about the item result
    testomatioReporter.addTestRun(null, 'passed', testData);
  });

  // test assertion
  emitter.on('assertion', function (err: any, assertion: NewmanRunExecutionAssertion) {
    if (err) console.error(err);
    if (assertion.error) {
      assertionErrorTextColorized = chalk.red(`${assertion.error.name}: ${assertion.error.message}`);
    }
  });

  // every time a console function is called from within any script, this event is propagated
  emitter.on('console', function (err: AnyObject, event: ConsoleEvent) {
    if (err) console.error(err);
    console.log(APP_PREFIX, chalk.grey('CONSOLE:', JSON.stringify(event.messages)));
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
