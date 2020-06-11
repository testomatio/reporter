const { event, recorder } = require('codeceptjs');
const TestomatClient = require('../client');
const TRConstants = require('../constants');

const parseTest = tags => {
  for (const tag of tags) {
    if (tag.startsWith('@T')) {
      return tag.substring(2, tag.length);
    }
  }

  return null;
};

const getTestAndMessgae = title => {
  const testObj = { message: '' };
  const testArr = title.split(/\s(\|\s\{.*?\})/);
  testObj.title = testArr[0];
  if (testArr[1]) {
    testObj.message = `with values : ${testArr[1].match(/\{.*?\}/)}`;
  }

  return testObj;
};


module.exports = (config) => {
  let failedTests = [];
  const testTimeMap = {};
  const { apiKey } = config;

  const getDuration = test => {
    if (testTimeMap[test.id]) {
      return Date.now() - testTimeMap[test.id];
    }

    return 0;
  };

  if (apiKey === '' || apiKey === undefined) {
    throw new Error('Testomat API key cannot be empty');
  }
  const client = new TestomatClient({ apiKey });

  recorder.startUnlessRunning();


  // Listening to events
  event.dispatcher.on(event.all.before, () => {
    recorder.add('Creating new run', () => client.createRun());
  });

  event.dispatcher.on(event.test.started, (test) => {
    testTimeMap[test.id] = Date.now();
  });

  event.dispatcher.on(event.all.result, () => {
    const status = failedTests.length === 0 ? TRConstants.PASSED : TRConstants.FAILED;
    recorder.add('Creating new run', () => client.updateRunStatus(status));
  });

  event.dispatcher.on(event.test.failed, (test, err) => {
    const { id, tags, title } = test;
    if (id) {
      failedTests.push(id);
    }
    const testId = parseTest(tags);
    const testObj = getTestAndMessgae(title);
    const errMessage = `${err.message || err.inspect()}, ${testObj.message}`;
    recorder.add('Adding TestRun status', () => client.addTestRun(testId, TRConstants.FAILED, errMessage, testObj.title, getDuration(test)));
  });

  event.dispatcher.on(event.test.passed, (test) => {
    const { id, tags, title } = test;
    if (id && failedTests.includes(id)) {
      failedTests = failedTests.filter(failed => id !== failed);
    }
    const testId = parseTest(tags);
    const testObj = getTestAndMessgae(title);
    recorder.add('Adding TestRun status', () => client.addTestRun(testId, TRConstants.PASSED, testObj.message, testObj.title, getDuration(test)));
  });
};
