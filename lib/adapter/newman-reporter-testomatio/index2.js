"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const reporter_1 = __importDefault(require("@testomatio/reporter"));
const chalk_1 = __importDefault(require("chalk"));
const APP_PREFIX = chalk_1.default.gray('[TESTOMATIO-NEWMAN-REPORTER]');
// emitter is an event emitter that triggers the following events: https://github.com/postmanlabs/newman#newmanrunevents
// reporterOptions is an object of the reporter specific options. See usage examples below for more details.
// collectionRunOptions is an object of all the collection run options: https://github.com/postmanlabs/newman#newmanrunoptions-object--callback-function--run-eventemitter
function TestomatioNewmanReporter(emitter, reporterOptions, collectionRunOptions) {
    // initialize Testomatio reporter
    const testomatioReporter = new reporter_1.default.TestomatClient(reporterOptions);
    // listen to the Newman events
    // collection start
    emitter.on('start', function (err, args) {
        if (err)
            console.error(err);
        testomatioReporter.createRun();
    });
    // when an item (the whole set of prerequest->request->test) completes
    emitter.on('item', function (err, result) {
        if (err)
            console.error(err);
        // testomatioReporter.emit('item', err, args);
        console.log(' - - - - - ITEM DONE - - - - - ');
        console.log(JSON.stringify(result));
        const request = result.request;
        const events = result.item.events;
        // steps names like test, prerequest etc
        const steps = events.map(event => {
            // console.log(' 8 8 8 8 8 8 8 8 8 8 ')
            // console.log(JSON.stringify(event));
            // console.log(' 8 8 8 8 8 8 8 8 8 8 ')
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
    emitter.on('console', function (err, event) {
        if (err)
            console.error(err);
        console.log(APP_PREFIX, chalk_1.default.grey('CONSOLE:', event.messages));
    });
    // collection run finished
    emitter.on('done', function (err, summary) {
        if (err)
            console.error(err);
        const runResult = {
            collectionName: summary.collection,
        };
        const status = summary.run.failures.length ? 'failed' : 'passed';
        console.log(APP_PREFIX, chalk_1.default.blue('Run result:', status));
        // notify Testomatio that the test run has finished
        testomatioReporter.updateRunStatus(status);
        console.log(' - - - - - DONE - - - - - ');
        console.log(JSON.stringify(summary));
        console.log(' - - - - - DONE - - - - - ');
    });
}
module.exports = TestomatioNewmanReporter;
