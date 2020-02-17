const { TestomatClient } = require('testomat-reporter');

const client = new TestomatClient({ apiKey: 'l5x5d5cd6pc3' });

client.createRun().then(async () => {
  await client.addTestRun('cc883e99', 'passed');
  await client.addTestRun('7af2c281', 'passed');
  await client.addTestRun('6603c29e', 'passed');
  await client.addTestRun('95956b60', 'failed', 'Test case failed');

  client.updateRunStatus('failed');
});
