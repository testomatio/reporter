const { event, recorder } = require('codeceptjs');
const TestomatClient = require('../client');

module.exports = (config) => {
  const { apiKey } = config;

  if (apiKey === '' || apiKey === undefined) {
    throw new Error('Testomat API key cannot be empty');
  }

  const client = new TestomatClient({ apiKey });
  recorder.startUnlessRunning();

  console.log('Hi hello 123');

  event.dispatcher.on(event.suite.before, () => {
    console.log('edkjn sdfi');
  });

  event.dispatcher.on(event.test.before, () => {
    console.log('hiii');
  });

  event.dispatcher.on(event.all.result, () => {
    console.log('asd');
  });

  event.dispatcher.on(event.test.failed, (test, err) => {
    console.error('Hello 123');
    console.log(test);
    console.log(err);
  });
};
