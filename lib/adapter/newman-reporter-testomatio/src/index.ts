import { ConsoleEvent, NewmanRunExecution, NewmanRunExecutionItem, NewmanRunOptions, NewmanRunSummary } from 'newman';
import TestomatioReporter from '@testomatio/reporter';
import chalk from 'chalk';

// FIXME: when add chulk to package.json, this reporter does not work. have to investigate and try to fix

type AnyObject = {
  [key: string]: any;
}

type SearchParams = { key: string, value: string }[];

type URL = {
  protocol: 'https' | 'http',
  path: string[],
  host: string[],
  query: SearchParams,
  variable: { [key: string]: any }[],
}

function stringifySearchParams(searchParams: SearchParams): string {
  searchParams = JSON.parse(JSON.stringify(searchParams));

  if (!searchParams.length) return '';

  // url params starts with ? sign like ?param=value
  let result = '?';

  for (const param of searchParams) {
    result += (param.key + '=' + param.value);
  }
  return result;
}

function stringifyURL(url: URL): string {
  return `${url.protocol}://${url.host.join('.')}/${url.path.join('/')}${stringifySearchParams(url.query)}`
}

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

  // listen to the Newman events

  // collection start
  emitter.on('start', function (err: any, newmanRun: NewmanRunExecution) {
    if (err) console.error(err);
    testomatioReporter.createRun();
  });

  // response received
  emitter.on('request', function (err: any, newmanRun: NewmanRunExecution) {
    if (err) console.error(err);
    responseCodeAndStatusColorized = newmanRun.response.code < 300 ? chalk.green(newmanRun.response.code, newmanRun.response.status) : chalk.red(newmanRun.response.code, newmanRun.response.status);
  });

  // when an item (the whole set of prerequest->request->test) completes
  emitter.on('item', function (err: AnyObject | null, result: NewmanRunExecution) {
    if (err) console.error(err);

    let steps = '';
    const request = result.item.request;
    const requestURL = request.url as unknown as URL;
    steps += `request\n${request.method} ${stringifyURL(requestURL)}`;
    steps += responseCodeAndStatusColorized ? `\nresponse\n${responseCodeAndStatusColorized}`: '';

    const events = result.item.events;

    // events includes prerequest, tests etc
    events.map(event => {
      const eventName = event.listen;
      const eventScripts = event.script.exec;
      const eventScriptsAsStr = eventScripts?.join('\n');
      if (eventScriptsAsStr) steps += `\n\n${chalk.blue(eventName)}\n${chalk.grey(eventScriptsAsStr)}`;
    });


    // TODO: add error to steps. here or in 'request' handler

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

  // every time a console function is called from within any script, this event is propagated
  emitter.on('console', function (err: AnyObject, event: ConsoleEvent) {
    if (err) console.error(err);
    console.log(APP_PREFIX, chalk.grey('CONSOLE:', event.messages));
  });

  // collection run finished
  emitter.on('done', function (err: AnyObject | null, summary: NewmanRunSummary) {
    if (err) console.error(err);

    const status = summary.run.failures.length ? 'failed' : 'passed';
    console.log(APP_PREFIX, chalk.blue('Run result:', status));

    // notify Testomatio that the test run has finished
    testomatioReporter.updateRunStatus(status);
    // console.log(' - - - - - DONE - - - - - ');
    // console.log(JSON.stringify(summary));
    // console.log(' - - - - - DONE - - - - - ');
  });
}

module.exports = TestomatioNewmanReporter;
