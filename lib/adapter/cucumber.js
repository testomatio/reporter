// eslint-disable-next-line import/no-unresolved
try {
  require.resolve("@cucumber/cucumber");
  module.exports = require('./cucumber/current');
} catch (err) {
  try {
    require.resolve('cucumber');
    module.exports = require('./cucumber/legacy');
  } catch (err) {
    console.error('Cucumber packages: "@cucumber/cucumber" or "cucumber" were not detected. Report won\'t be sent', err);
    module.exports = {}
  }
}
