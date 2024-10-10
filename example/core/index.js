const { TestomatClient, TRConstants } = require('testomat-reporter');

const client = new TestomatClient({ apiKey: 'l5x5d5cd6pc3' });

client
  .createRun()
  .then(async () => {
    await client.addTestRun('cc883e99', TRConstants.PASSED);
    await client.addTestRun('7af2c281', TRConstants.PASSED);
    await client.addTestRun('6603c29e', TRConstants.PASSED);
    await client.addTestRun('95956b60', TRConstants.FAILED, 'Test case failed');

    client.updateRunStatus(TRConstants.FAILED);
  })
  .catch(console.log);
