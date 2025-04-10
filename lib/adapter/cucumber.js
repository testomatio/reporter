try {
  // eslint-disable-next-line import/no-unresolved
  require.resolve('@cucumber/cucumber');
  // eslint-disable-next-line global-require, import/no-extraneous-dependencies
  module.exports = require('./cucumber/current');
} catch (_e) {
  try {
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    require.resolve('cucumber');
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    module.exports = require('./cucumber/legacy');
  } catch (_err) {
    console.error('Cucumber packages: "@cucumber/cucumber" or "cucumber" were not detected. Report won\'t be sent');
    module.exports = {};
  }
}
