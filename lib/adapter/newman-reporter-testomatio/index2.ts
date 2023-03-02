import { ConsoleEvent, NewmanRunExecution, NewmanRunExecutionItem, NewmanRunOptions, NewmanRunSummary } from 'newman';
import TestomatioReporter from '@testomatio/reporter';
import chalk from 'chalk';

// FIXME: when add chulk to package.json, this reporter does not work. have to investigate and try to fix

type AnyObject = {
  [key: string]: any;
}

const APP_PREFIX = chalk.gray('[TESTOMATIO-NEWMAN-REPORTER]');

// emitter is an event emitter that triggers the following events: https://github.com/postmanlabs/newman#newmanrunevents
// reporterOptions is an object of the reporter specific options. See usage examples below for more details.
// collectionRunOptions is an object of all the collection run options: https://github.com/postmanlabs/newman#newmanrunoptions-object--callback-function--run-eventemitter
function TestomatioNewmanReporter(emitter: AnyObject, reporterOptions: AnyObject, collectionRunOptions: NewmanRunOptions) {
  // initialize Testomatio reporter
  const testomatioReporter = new TestomatioReporter.TestomatClient(reporterOptions);

  // listen to the Newman events

  // collection start
  emitter.on('start', function (err: any, args: NewmanRunExecution) {
    if (err) console.error(err);
    testomatioReporter.createRun();
  });

  // when an item (the whole set of prerequest->request->test) completes
  emitter.on('item', function (err: AnyObject | null, result: NewmanRunExecution) {
    if (err) console.error(err);
    console.log(' - - - - - ITEM DONE - - - - - ');
    console.log(JSON.stringify(result));

    const request = result.request;

    const events = result.item.events;
    // steps names like test, prerequest etc
    const steps = events.map(event => {
      return event.listen;
    }).join(', ');

    console.log(' - - - - - STEPS - - - - - ');
    console.log(steps);

    const testData = {
      error: '',
      time: '',
      example: null,
      files: [],
      filesBuffers: [],
      steps,
      title: result.item.name,
      suite_title: typeof collectionRunOptions.collection === 'string' ? collectionRunOptions.collection : collectionRunOptions.collection.name,
      suite_id: '',
    };

    console.log(testData);

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
    const runResult = {
      collectionName: summary.collection,
    };
    
    const status = summary.run.failures.length ? 'failed' : 'passed';
    console.log(APP_PREFIX, chalk.blue('Run result:', status));

    // notify Testomatio that the test run has finished
    testomatioReporter.updateRunStatus(status);
    console.log(' - - - - - DONE - - - - - ');
    console.log(JSON.stringify(summary));
    console.log(' - - - - - DONE - - - - - ');
  });
}

module.exports = TestomatioNewmanReporter;
